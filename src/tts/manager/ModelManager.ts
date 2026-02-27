import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';

/**
 * Progress callback for model downloads
 */
export type DownloadProgressCallback = (progress: {
  loaded: number;
  total: number;
  percentage: number;
}) => void;

/**
 * Required files for a voice model
 */
const REQUIRED_MODEL_FILES = ['model.onnx', 'tokens.txt'];

/**
 * Model Manager for voice model lifecycle management
 * Handles downloading, extraction, verification, and deletion of voice models
 */
export class ModelManager {
  private baseUrl: string;
  private voicesDirectory: string;

  /**
   * Create a new ModelManager
   * @param baseUrl - Base URL for voice model downloads (e.g., GitHub releases URL)
   */
  constructor(
    baseUrl: string = 'https://github.com/rhasspy/piper/releases/download',
  ) {
    this.baseUrl = baseUrl;
    this.voicesDirectory = `${RNFS.DocumentDirectoryPath}/voices`;
  }

  /**
   * Initialize the model manager
   * Creates the voices directory if it doesn't exist
   */
  async initialize(): Promise<void> {
    const exists = await RNFS.exists(this.voicesDirectory);
    if (!exists) {
      await RNFS.mkdir(this.voicesDirectory);
    }
  }

  /**
   * Get the path to a downloaded model
   * @param modelId - The model identifier
   * @returns Absolute path to the model directory
   */
  getModelPath(modelId: string): string {
    return `${this.voicesDirectory}/${modelId}`;
  }

  /**
   * Check if a model is downloaded and verified
   * @param modelId - The model identifier
   * @returns true if model exists and passes verification
   */
  async isModelDownloaded(modelId: string): Promise<boolean> {
    const modelPath = this.getModelPath(modelId);
    const exists = await RNFS.exists(modelPath);
    if (!exists) {
      return false;
    }
    return this.verifyModel(modelId);
  }

  /**
   * Verify that all required model files exist
   * @param modelId - The model identifier
   * @returns true if all required files are present
   */
  async verifyModel(modelId: string): Promise<boolean> {
    const modelPath = this.getModelPath(modelId);

    try {
      for (const file of REQUIRED_MODEL_FILES) {
        const filePath = `${modelPath}/${file}`;
        const exists = await RNFS.exists(filePath);
        if (!exists) {
          console.warn(`Missing required file: ${file}`);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Model verification failed:', error);
      return false;
    }
  }

  /**
   * Download a voice model from the base URL
   * @param modelId - The model identifier (e.g., 'en_US-ryan-medium')
   * @param onProgress - Optional progress callback
   * @returns Promise that resolves when download and extraction complete
   */
  async downloadModel(
    modelId: string,
    onProgress?: DownloadProgressCallback,
  ): Promise<void> {
    // Construct the download URL
    // Format: {baseUrl}/{version}/{modelId}.onnx.zip
    // Example: https://github.com/rhasspy/piper/releases/download/2024.08.14-2/en_US-ryan-medium.onnx.zip
    const version = '2024.08.14-2';
    const zipUrl = `${this.baseUrl}/${version}/${modelId}.onnx.zip`;
    const modelPath = this.getModelPath(modelId);

    // Check if already downloaded
    if (await this.isModelDownloaded(modelId)) {
      console.log(`Model ${modelId} already downloaded`);
      return;
    }

    // Create model directory
    const exists = await RNFS.exists(modelPath);
    if (!exists) {
      await RNFS.mkdir(modelPath);
    }

    // Download the zip file
    const downloadPath = `${modelPath}.zip`;

    try {
      const downloadResult = RNFS.downloadFile({
        fromUrl: zipUrl,
        toFile: downloadPath,
        progress: res => {
          if (onProgress) {
            onProgress({
              loaded: res.bytesWritten,
              total: res.contentLength || 0,
              percentage: res.contentLength
                ? Math.round((res.bytesWritten / res.contentLength) * 100)
                : 0,
            });
          }
        },
        progressDivider: 1,
      });

      const result = await downloadResult.promise;

      if (result.statusCode !== 200) {
        throw new Error(`Download failed with status ${result.statusCode}`);
      }

      // Extract the zip file
      await unzip(downloadPath, modelPath);

      // Clean up the zip file
      await RNFS.unlink(downloadPath);

      // Verify the model
      const isValid = await this.verifyModel(modelId);
      if (!isValid) {
        // Clean up if verification fails
        await this.deleteModel(modelId);
        throw new Error(
          `Model ${modelId} verification failed - missing required files`,
        );
      }

      console.log(`Model ${modelId} downloaded and verified successfully`);
    } catch (error) {
      // Clean up on error
      const modelExists = await RNFS.exists(modelPath);
      if (modelExists) {
        await RNFS.unlink(modelPath).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Delete a downloaded voice model
   * @param modelId - The model identifier
   */
  async deleteModel(modelId: string): Promise<void> {
    const modelPath = this.getModelPath(modelId);
    const exists = await RNFS.exists(modelPath);

    if (exists) {
      await RNFS.unlink(modelPath);
      console.log(`Model ${modelId} deleted`);
    }
  }

  /**
   * Get list of all downloaded model IDs
   * @returns Array of downloaded model IDs
   */
  async getDownloadedModels(): Promise<string[]> {
    try {
      const exists = await RNFS.exists(this.voicesDirectory);
      if (!exists) {
        return [];
      }

      const items = await RNFS.readDir(this.voicesDirectory);
      const modelIds: string[] = [];

      for (const item of items) {
        if (item.isDirectory()) {
          const modelId = item.name;
          // Only include verified models
          if (await this.verifyModel(modelId)) {
            modelIds.push(modelId);
          }
        }
      }

      return modelIds;
    } catch (error) {
      console.error('Failed to get downloaded models:', error);
      return [];
    }
  }

  /**
   * Get the base URL for model downloads
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set the base URL for model downloads
   * @param baseUrl - New base URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Get the voices directory path
   */
  getVoicesDirectory(): string {
    return this.voicesDirectory;
  }
}
