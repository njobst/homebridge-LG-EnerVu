import { PlatformConfig, AccessoryName, AccessoryIdentifier, Logger } from 'homebridge';

interface User {
  email: string;
  password: string;
}

export interface sessionData{
  Cookie: string;
  system_id: string;
  ess_id: string;
}

export interface LgEnerVuPlatformConfig extends PlatformConfig {
  platform: AccessoryName | AccessoryIdentifier;
  name?: string;

  // Added properties
  user: User;
  refreshTimeInMinutes: number;
  latestDataForPower: boolean;
  language: string;
  userAgent: string;
  updateMotionSensor: boolean;
  batterySoc: boolean;
  pvPower: boolean;
  batteryPower: boolean;
  gridPower: boolean;
  loadPower: boolean;

  sessionData: sessionData;
}

export interface homebridgePlatformConfig{
  platforms: LgEnerVuPlatformConfig[];
}

function validateConfigField(
  log: Logger,
  type: string,
  key: string,
  mandatory: boolean,
  value?: unknown,
): boolean {
  if (mandatory && typeof value !== type || // check type for mandatory
    (!mandatory && value !== undefined && typeof value !== type)) { // check type if value was set for non mandatory
    log.error(
      `Config ${key} has invalid value: ${value}. Expected ${type}, got ${typeof value}: ${value}`,
    );
    return false;
  }
  if (typeof value === 'string' && value === ''){
    log.debug(`Empty ${key} is not allowed`);
    return false;
  }
  log.debug(`Validated ${key}, value ${value} fulfills ${type} for mandatory: ${mandatory}`);
  return true;
}

export class LgEnerVuPlatformConfig implements PlatformConfig {
  public static isValid(config: PlatformConfig, log: Logger): boolean {
    const cast = config as LgEnerVuPlatformConfig;
    if (
      (cast.user !== undefined) &&
      validateConfigField(log, 'string', 'User Email', true, cast.user.email) &&
      validateConfigField(log, 'string', 'UserPassword', true, cast.user.password) &&
      validateConfigField(log, 'boolean', 'UpdateMotionSensor', false, cast.updateMotionSensor) &&
      validateConfigField(log, 'boolean', 'BatterySoc', false, cast.batterySoc) &&
      validateConfigField(log, 'boolean', 'PvPower', false, cast.pvPower) &&
      validateConfigField(log, 'boolean', 'BatteryPower', false, cast.batteryPower) &&
      validateConfigField(log, 'boolean', 'GridPower', false, cast.gridPower) &&
      validateConfigField(log, 'boolean', 'loadPower', false, cast.loadPower) &&
      validateConfigField(log, 'number', 'refreshTimeInMinutes', false, cast.refreshTimeInMinutes) &&
      validateConfigField(log, 'string', 'language', false, cast.language) &&
      validateConfigField(log, 'string', 'user', false, cast.userAgent) &&
      ((cast.sessionData === undefined) || // empty session data is filled during convert
      (cast.sessionData !== undefined &&
        validateConfigField(log, 'string', 'Cookie', true, cast.sessionData.Cookie) &&
        validateConfigField(log, 'string', 'system_id', true, cast.sessionData.system_id) &&
        validateConfigField(log, 'string', 'ess_id', true, cast.sessionData.ess_id)
      ))
    ){
      log.info('Validated config');
      return true;
    }
    return false;
  }

  public static convert(config: PlatformConfig): LgEnerVuPlatformConfig{
    const lgEnervuConfig = config as LgEnerVuPlatformConfig;
    if (lgEnervuConfig.sessionData === undefined){
      lgEnervuConfig.sessionData = {} as sessionData;
    }

    // set default values
    lgEnervuConfig.refreshTimeInMinutes = lgEnervuConfig.refreshTimeInMinutes || 1;
    lgEnervuConfig.latestDataForPower = lgEnervuConfig.latestDataForPower || true;
    lgEnervuConfig.language = lgEnervuConfig.language || 'de-DE';
    lgEnervuConfig.userAgent = lgEnervuConfig.userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    lgEnervuConfig.updateMotionSensor = lgEnervuConfig.updateMotionSensor || true;
    lgEnervuConfig.batteryPower = lgEnervuConfig.batteryPower || true;
    lgEnervuConfig.batterySoc = lgEnervuConfig.batterySoc || true;
    lgEnervuConfig.gridPower = lgEnervuConfig.gridPower || true;
    lgEnervuConfig.loadPower = lgEnervuConfig.loadPower || true;
    lgEnervuConfig.pvPower = lgEnervuConfig.pvPower || true;

    return lgEnervuConfig;
  }

}