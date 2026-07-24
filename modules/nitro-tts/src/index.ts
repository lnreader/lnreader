import { NitroModules } from 'react-native-nitro-modules';
import type { TtsFactory } from './specs/TtsFactory.nitro';

export const Tts = NitroModules.createHybridObject<TtsFactory>('TtsFactory');

export type { TtsFactory } from './specs/TtsFactory.nitro';
export type { TtsSession } from './specs/TtsSession.nitro';
export type { ListenerSubscription } from './types/ListenerSubscription';
export type { TtsEngine } from './types/TtsEngine';
export type { TtsMetadata } from './types/TtsMetadata';
export type { TtsParagraph } from './types/TtsParagraph';
export type { TtsPlaybackState } from './types/TtsPlaybackState';
export type { TtsProgress } from './types/TtsProgress';
export type { TtsSettings } from './types/TtsSettings';
export type { TtsVoice } from './types/TtsVoice';
