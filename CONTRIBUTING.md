# Contributing Guide

Contributions are welcome and are greatly appreciated!

## Setup Your Environment with Nix

If you are on a Linux system, you can install the nix package manager and use the nix flakes to set up your development environment.
See [CONTRIBUTING-NIX.md](CONTRIBUTING-NIX.md)

## Setting Up Your Environment

After forking to your own GitHub org or account, do the following steps to get started:

```bash
# prerequisites
node --version >= 20   (for version management, get nvm [recommended])
java sdk --version >= 17    (for version management, get jenv [optional])
android sdk                 (https://developer.android.com/studio)

# clone your fork to your local machine
git clone https://github.com/<your-account-name>/lnreader.git

# step into local repo
cd lnreader

# install pnpm (if not already installed)
npm install -g pnpm

# install dependencies
pnpm install

# build the apk (the built apk will be found in ~/lnreader/android/app/build/outputs/apk/release/)
pnpm run build:release:android
```

### Developing on Android

You will need an Android device or emulator connected to your computer as well as an IDE of your choice (e.g., VS Code).

```bash
# prerequisites
adb                         (https://developer.android.com/studio/command-line/adb)
IDE

# check if android device/emulator is connected
adb devices

# run metro for development
pnpm run dev:start

# then to view on your android device (new terminal)
pnpm run dev:android
```

### Style & Linting

This codebase's linting rules are enforced using [ESLint](http://eslint.org/).

It is recommended that you install an eslint plugin for your editor of choice when working on this
codebase, however you can always check to see if the source code is compliant by running:

```bash
pnpm run lint
```
