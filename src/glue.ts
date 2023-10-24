import {
    ActivateChain,
    EventMap,
    Glue,
    RequestAccounts,
    RequestAccountsEvent,
    SendTransaction,
    SignMessage,
    SignTransaction,
    SwitchEthereumChain,
} from "@wallet-test-framework/glue";
import { URL } from "node:url";
import { Builder, By, WebDriver, until } from "selenium-webdriver";
import Chrome from "selenium-webdriver/chrome.js";
import { NoSuchWindowError } from "selenium-webdriver/lib/error.js";

function delay(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
}

class Lock<T> {
    private readonly data: T;
    private readonly queue: (() => Promise<void>)[];
    private locked: boolean;

    constructor(data: T) {
        this.data = data;
        this.queue = [];
        this.locked = false;
    }

    public unsafe(): T {
        return this.data;
    }

    public lock<R>(callback: (data: T) => Promise<R>): Promise<R> {
        if (this.locked) {
            console.debug("Queuing");
            return new Promise<R>((res, rej) => {
                this.queue.push(() => callback(this.data).then(res).catch(rej));
            });
        }

        console.debug("Locking");
        this.locked = true;
        return callback(this.data).finally(() => this.after());
    }

    private after() {
        if (0 === this.queue.length) {
            console.debug("Unlocking");
            this.locked = false;
        } else {
            const item = this.queue.shift();
            console.debug("Running task", item);
            if (typeof item === "undefined") {
                throw new Error("lock queue empty");
            }

            void item().finally(() => this.after());
        }
    }
}

class CoinbaseDriver {
    public static readonly PASSWORD = "ethereum1";
    public static readonly EXTENSION_URL =
        "chrome-extension://hnfanknocfeofbddgcijnmhnfnkdnaad/index.html?inPageRequest=false";
    private readonly newWindows: string[];
    private readonly driver: Lock<WebDriver>;
    private running: boolean;
    private windowWatcher: Promise<void>;
    private readonly glue: CoinbaseGlue;

    private constructor(driver: WebDriver, glue: CoinbaseGlue) {
        this.driver = new Lock(driver);
        this.running = true;
        this.windowWatcher = this.watchWindows();
        this.newWindows = [];
        this.glue = glue;
    }

    public static async create(glue: CoinbaseGlue): Promise<CoinbaseDriver> {
        const chrome = new Chrome.Options();
        chrome.setBrowserVersion("117.0.5938.149");
        chrome.addExtensions("/home/sam/coinbase.crx");

        const driver = await new Builder()
            .forBrowser("chrome")
            .setChromeOptions(chrome)
            .build();

        await driver.manage().setTimeouts({ implicit: 10000 });

        return new CoinbaseDriver(driver, glue);
    }

    public async unlockWithPassword(driver: WebDriver): Promise<void> {
        const inputs = await driver.findElements(
            By.css("[data-testid='unlock-with-password']"),
        );
        if (inputs.length <= 0) {
            return;
        }

        await driver.wait(until.elementIsVisible(inputs[0]), 2000);
        await inputs[0].sendKeys(CoinbaseDriver.PASSWORD + "\n");
        await delay(1000);
    }

    private async emitRequestAccounts(
        driver: WebDriver,
        handle: string,
    ): Promise<void> {
        console.debug("emitting requestaccounts");
        await this.unlockWithPassword(driver);

        this.glue.emit(
            "requestaccounts",
            new RequestAccountsEvent(handle, {
                accounts: [],
            }),
        );
    }

    private async processNewWindow(
        driver: WebDriver,
        handle: string,
    ): Promise<void> {
        console.debug("Processing window", handle);
        await driver.switchTo().window(handle);

        const location = await driver.getCurrentUrl();
        const url = new URL(location);
        const action = url.searchParams.get("action");

        let title;
        switch (action) {
            case "requestEthereumAccounts":
                await this.emitRequestAccounts(driver, handle);
                break;
            default:
                title = await driver.getTitle();
                console.warn(
                    "unknown event from window",
                    title,
                    "@",
                    location,
                    "(",
                    handle,
                    ")",
                );
                return;
        }
    }

    private async processNewWindows(): Promise<void> {
        await this.driver.lock(async (driver) => {
            const popped = this.newWindows.splice(0);

            let current = null;

            try {
                current = await driver.getWindowHandle();
            } catch {
                /* no-op */
            }

            try {
                for (const one of popped) {
                    try {
                        await this.processNewWindow(driver, one);
                    } catch (e) {
                        if (e instanceof NoSuchWindowError) {
                            console.debug("Window", one, "disappeared");
                            continue;
                        } else {
                            throw e;
                        }
                    }
                }
            } finally {
                if (current) {
                    await driver.switchTo().window(current);
                }
            }
        });
    }

    private async watchWindows(): Promise<void> {
        let previous: string[] = await this.driver
            .unsafe()
            .getAllWindowHandles();

        while (this.running) {
            const next = await this.driver.unsafe().getAllWindowHandles();
            const created = next.filter((v) => !previous.includes(v));
            previous = next;

            if (created.length > 0) {
                console.debug("Found windows", created);
                this.newWindows.push(...created);
                await this.processNewWindows();
            }

            await delay(500);
        }
    }

    public lock<T>(callback: (wb: WebDriver) => Promise<T>): Promise<T> {
        return this.driver.lock(callback);
    }

    public async setup(): Promise<void> {
        await this.driver.lock(async (driver) => {
            await driver.navigate().to(CoinbaseDriver.EXTENSION_URL);

            const importExisting = await driver.findElement(
                By.css("[data-testid='btn-import-existing-wallet']"),
            );
            await driver.wait(until.elementIsVisible(importExisting), 2000);
            await importExisting.click();

            const byPhrase = await driver.findElement(
                By.css("[data-testid='btn-import-recovery-phrase']"),
            );
            await driver.wait(until.elementIsVisible(byPhrase), 2000);
            await byPhrase.click();

            const secretInput = await driver.findElement(
                By.css("[data-testid='secret-input']"),
            );
            await driver.wait(until.elementIsVisible(secretInput), 2000);
            await secretInput.sendKeys(
                "basket cradle actor pizza similar liar suffer another all fade flag brave",
            );

            const importWallet = await driver.findElement(
                By.css("[data-testid='btn-import-wallet']:not([disabled])"),
            );
            await driver.wait(until.elementIsVisible(importWallet), 2000);
            await importWallet.click();

            const setPassword = await driver.findElement(
                By.css("[data-testid='setPassword']"),
            );
            await driver.wait(until.elementIsVisible(setPassword), 2000);
            await setPassword.sendKeys(CoinbaseDriver.PASSWORD);

            const setPasswordVerify = await driver.findElement(
                By.css("[data-testid='setPasswordVerify']"),
            );
            await driver.wait(until.elementIsVisible(setPasswordVerify), 2000);
            await setPasswordVerify.sendKeys("ethereum1");

            const terms = await driver.findElement(
                By.css("[data-testid='terms-and-privacy-policy-parent']"),
            );
            await driver.wait(until.elementIsVisible(terms), 2000);
            await terms.click();

            const passwordContinue = await driver.findElement(
                By.css("[data-testid='btn-password-continue']:not([disabled])"),
            );
            await driver.wait(until.elementIsVisible(passwordContinue), 2000);
            await passwordContinue.click();

            const bell = await driver.findElement(
                By.css("[data-testid='notification-bell-container']"),
            );
            await driver.wait(until.elementIsVisible(bell), 2000);
        });
    }
}

export class CoinbaseGlue extends Glue {
    private static async buildDriver(
        glue: CoinbaseGlue,
    ): Promise<CoinbaseDriver> {
        const coinbase = await CoinbaseDriver.create(glue);
        await coinbase.setup();
        return coinbase;
    }

    private readonly driver = CoinbaseGlue.buildDriver(this);

    async launch(url: string): Promise<void> {
        const cb = await this.driver;
        await cb.lock(async (driver) => {
            await driver.navigate().to(url);

            const btn = await driver.findElement(By.css("#connect"));
            await driver.wait(until.elementIsVisible(btn), 2000);
            await btn.click();
        });
    }

    override async activateChain(action: ActivateChain): Promise<void> {
        const cb = await this.driver;
        await cb.lock(async (driver) => {
            const current = await driver.getWindowHandle();
            await driver.switchTo().newWindow("window");
            await driver.navigate().to(CoinbaseDriver.EXTENSION_URL);
            await cb.unlockWithPassword(driver);

            const settingsLink = await driver.findElement(
                By.css("[data-testid='settings-navigation-link']"),
            );
            await driver.wait(until.elementIsVisible(settingsLink), 2000);
            await settingsLink.click();

            const networksMenu = await driver.findElement(
                By.css("[data-testid='settings-networks-menu-cell-pressable']"),
            );
            await driver.wait(until.elementIsVisible(networksMenu), 2000);
            await networksMenu.click();

            const addCustom = await driver.findElement(
                By.css("[data-testid='add-custom-network']"),
            );
            await driver.wait(until.elementIsVisible(addCustom), 2000);
            const windowsBefore = await driver.getAllWindowHandles();
            await addCustom.click();

            const newWindow = await driver.wait(async () => {
                const handles = await driver.getAllWindowHandles();
                const newWindows = handles.filter(
                    (x) => !windowsBefore.includes(x),
                );
                return newWindows.length > 0 ? newWindows[0] : false;
            }, 10000);

            if (!newWindow) {
                throw new Error("custom testnet window disappeared");
            }
            console.debug("Switching to custom network window", newWindow);
            await driver.switchTo().window(newWindow);
            await cb.unlockWithPassword(driver);

            const name = await driver.findElement(
                By.css("[data-testid='custom-network-name-input']"),
            );
            await driver.wait(until.elementIsVisible(name), 2000);
            await name.sendKeys(`Test Chain ${action.chainId}`);

            const rpcUrl = await driver.findElement(
                By.css("[data-testid='custom-network-rpc-url-input']"),
            );
            await driver.wait(until.elementIsVisible(rpcUrl), 2000);
            await rpcUrl.sendKeys(action.rpcUrl);

            const chainId = await driver.findElement(
                By.css("[data-testid='custom-network-chain-id-input']"),
            );
            await driver.wait(until.elementIsVisible(chainId), 2000);
            await chainId.sendKeys(action.chainId);

            const save = await driver.findElement(
                By.css("[data-testid='custom-network-save']:not([disabled])"),
            );
            await save.click();

            await driver.switchTo().window(current);
        });
    }

    override async requestAccounts(action: RequestAccounts): Promise<void> {
        const cb = await this.driver;
        await cb.lock(async (driver) => {
            const current = await driver.getWindowHandle();
            try {
                await driver.switchTo().window(action.id);
                let testid: string;

                switch (action.action) {
                    case "approve":
                        testid = "allow-authorize-button";
                        break;
                    case "reject":
                        testid = "deny-authorize-button";
                        break;
                    default:
                        throw new Error(
                            `unsupported action ${action as string}`,
                        );
                }

                const btn = await driver.findElement(
                    By.css(`[data-testid='${testid}']:not([disabled])`),
                );
                await driver.wait(until.elementIsVisible(btn), 2000);
                await btn.click();
            } finally {
                await driver.switchTo().window(current);
            }
        });
    }

    // TODO: Remove eslint comment after implementing.
    // eslint-disable-next-line @typescript-eslint/require-await
    override async signMessage(_action: SignMessage): Promise<void> {
        throw new Error("cb - signMessage not implemented");
    }

    // TODO: Remove eslint comment after implementing.
    // eslint-disable-next-line @typescript-eslint/require-await
    override async sendTransaction(_action: SendTransaction): Promise<void> {
        throw new Error("cb - sendTransaction not implemented");
    }

    // TODO: Remove eslint comment after implementing.
    // eslint-disable-next-line @typescript-eslint/require-await
    override async signTransaction(_action: SignTransaction): Promise<void> {
        throw new Error("cb - signTransaction not implemented");
    }

    // TODO: Remove eslint comment after implementing.
    // eslint-disable-next-line @typescript-eslint/require-await
    override async switchEthereumChain(
        _action: SwitchEthereumChain,
    ): Promise<void> {
        throw new Error("cb - switchEthereumChain not implemented");
    }

    public emit<E extends keyof EventMap>(
        type: E,
        ...ev: Parameters<EventMap[E]>
    ): void {
        super.emit(type, ...ev);
    }
}
