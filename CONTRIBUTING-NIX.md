# React Native Development Nix Environment Setup

This document outlines how to set up your React Native development environment using Nix flakes for reproducibility and isolation.

## Disclaimer

This was tested on an Arch Linux system with AMD CPU and GPU. There are likely problems with NVIDIA GPUs.

Compatibility with Microsoft WSL2 is not guaranteed, but should work without major issues, except for the emulator.

## Prerequisites

- **Nix installed**: [https://nixos.org/download.html](https://nixos.org/download.html)
- **Git**: Required for cloning the repository.
- **KVM (for emulator, if enabled)**: Ensure KVM is enabled and your user is in the `kvm` group for optimal emulator performance:
  ```bash
  sudo usermod -aG kvm $USER && newgrp kvm # (or log out/in)
  kvm-ok # Verify KVM acceleration
  ```
- **GPU Drivers (for emulator, if enabled)**: For hardware-accelerated emulator (AMD/Intel), ensure host Vulkan drivers are working:
  ```bash
  vulkaninfo | grep -i "device name" # Should show your GPU
  ```
  If not, install `vulkan-radeon` (AMD) or `vulkan-intel` (Intel) on your host system and reboot.

## Getting Started

1.  **Clone the Project:**

    ```bash
    git clone <your-fork-url>
    cd <your-fork-name>
    ```

2.  **Enter the Development Shell:**

    If you have `pnpm` installed, use the defined scripts:

    - **For Physical Device Only (default):**
      ```bash
      pnpm run nix:shell
      ```
    - **For Emulator Development (explicitly enable):**
      ```bash
      pnpm run nix:emulator
      ```

    If you do not have `pnpm` installed, execute the commands manually:

    - **For Physical Device Only (default):**
      ```bash
      nix develop --extra-experimental-features nix-command --extra-experimental-features flakes
      ```
    - **For Emulator Development (explicitly enable):**
      ```
      nix develop .#emulator --extra-experimental-features nix-command --extra-experimental-features flakes
      ```

    The first time, this will download and set up all required tools, which can take considerable time. Subsequent entries will be much faster. You will also see a message about "Setting up writable Android SDK..." which only happens once.

## Development Workflow

Once inside the `nix develop` shell, all tools are available.

### 1. Start Metro Bundler

Open a new terminal or run in the background:

```bash
pnpm run dev:start
```

### 2. Physical Device Development

1.  **Connect Device**: Enable USB debugging on your Android device and connect it via USB.
2.  **Verify Device**:
    ```bash
    adb devices
    ```
3.  **Mirror Screen (Optional)**:
    ```bash
    scrcpy # Mirrors screen, provides control
    scrcpy -s <device_serial> # If multiple devices connected
    ```
4.  **Run App**:
    ```bash
    npx run android
    ```

### 3. Android Emulator Development (if enabled)

1.  **Launch Emulator**:

    ```bash
    emulator -avd ReactNative_API35 -gpu host -no-metrics -no-audio
    ```

    - Use `-gpu swiftshader_indirect` if hardware acceleration (`-gpu host`) fails.

2.  **Verify Emulator**:
    ```bash
    adb devices
    ```
3.  **Run App**:
    Launches the the emulater automatically, if it is not already running.
    ```bash
    npx run android
    ```
