// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from './20251222152612_past_mandrill/migration.sql';
import m0001 from './20260612232322_normal_saracen/migration.sql';
import m0002 from './20260719143427_long_moondragon/migration.sql';

export default {
  migrations: {
    "20251222152612_past_mandrill": m0000,
    "20260612232322_normal_saracen": m0001,
    "20260719143427_long_moondragon": m0002
  }
}
