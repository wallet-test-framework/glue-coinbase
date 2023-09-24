import {
    ActivateChain,
    Glue,
    RequestAccounts,
    SendTransaction,
    SignMessage,
    SignTransaction,
    SwitchEthereumChain,
} from "@wallet-test-framework/glue";

export class CoinbaseGlue extends Glue {
    override async activateChain(_action: ActivateChain): Promise<void> {
        throw "not implemented";
    }

    override async requestAccounts(_action: RequestAccounts): Promise<void> {
        throw "not implemented";
    }

    override async signMessage(_action: SignMessage): Promise<void> {
        throw "not implemented";
    }

    override async sendTransaction(_action: SendTransaction): Promise<void> {
        throw "not implemented";
    }

    override async signTransaction(_action: SignTransaction): Promise<void> {
        throw "not implemented";
    }

    override async switchEthereumChain(
        _action: SwitchEthereumChain
    ): Promise<void> {
        throw "not implemented";
    }
}
