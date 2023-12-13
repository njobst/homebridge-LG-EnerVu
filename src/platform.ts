import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { LgEnerVuPlatformAccessory } from './platformAccessory';
import { LgEnerVuPlatformConfig } from './config';
import { LgEnerVuApi } from './Api/webApi';

export class LgEnerVuHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public enerVuApi!: LgEnerVuApi;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {

    if(!LgEnerVuPlatformConfig.isValid(this.config, this.log)){
      log.error('Config is missing or not valid. Terminating Plugin');
      return;
    }
    const lgEnervuConfig = LgEnerVuPlatformConfig.convert(this.config);

    this.enerVuApi = new LgEnerVuApi(lgEnervuConfig, this.log, api.user.configPath());
    this.enerVuApi.start();

    this.log.debug('Finished initializing platform:', this.config.name);

    const homebridgeReady = new Promise<void>((resolve) => {
      this.api.on('didFinishLaunching', () => {
        log.debug('Executed didFinishLaunching callback');
        resolve();
      });
    });
    const apiReady = new Promise<void>((resolve) => {
      this.enerVuApi.on('firstLogin', () => {
        log.debug('Executed firstLogin callback');
        resolve();
      });
    });

    Promise.all([homebridgeReady, apiReady]).then(() => {
      log.debug('Adding Accessory');
      this.addAccessory();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  addAccessory() {

    // using ess_id and session_id as they are required and always available here, unlike serial
    const uniqueSystemId = this.enerVuApi.config.sessionData.ess_id + this.enerVuApi.config.sessionData.system_id;
    const uuid = this.api.hap.uuid.generate(uniqueSystemId);

    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      new LgEnerVuPlatformAccessory(this, existingAccessory, this.enerVuApi);

    } else {
      // the accessory does not yet exist, so we need to create it
      this.log.info('Adding new accessory:', 'LG EnerVu');

      // create a new accessory
      const accessory = new this.api.platformAccessory('LG EnerVu', uuid);

      new LgEnerVuPlatformAccessory(this, accessory, this.enerVuApi);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}

