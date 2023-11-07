## Wallet Test Framework: Coinbase

A tool to automate the Coinbase wallet use use with Wallet Test Framework.

## Installation

### Node

This project requires Nodejs version 20.6 or later.

### Dependencies

```bash
npm install
```

### Chrome Extension

The glue requires a local copy of Coinbase Wallet. The publicly available extension may be fetched with:

```bash
wget \
    -O coinbase.crx \
    'https://clients2.google.com/service/update2/crx?response=redirect&prodversion=118.0.5993.70&acceptformat=crx2,crx3&x=id%3Dhnfanknocfeofbddgcijnmhnfnkdnaad%26uc'
```

## Building

```bash
npm run build
```

### Tests & Linting (Optional)

```bash
npm test
```

## Running

```bash
npx glue-coinbase \
    --extension-path /path/to/crx/file
```
