import { PlatformAccessory, Logger } from 'homebridge';
import { LgEnerVuHomebridgePlatform } from './platform';
import { LgEnerVuApi } from './Api/webApi';
import { batteryNstatus, runningDataPoint} from './Api/interface';

type nestedByType<ObjectType extends object, T> =
{[Key in keyof ObjectType & (string | number)]//: ObjectType[Key] extends any[] ? never
: ObjectType[Key] extends object
? `${Key}.${nestedByType<ObjectType[Key], T> extends infer U extends string ? U : never}`
: ObjectType[Key] extends T
? `${Key}`
: never
}[keyof ObjectType & (string | number)];

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LgEnerVuPlatformAccessory {

  public api: LgEnerVuApi;
  public log: Logger;

  constructor(
    public readonly platform: LgEnerVuHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    api: LgEnerVuApi,
  ) {
    this.api = api;
    this.log = this.platform.log;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'LG');

    if (this.api.systemInfo !== undefined){
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Model, this.api.systemInfo.systemName)
        .setCharacteristic(this.platform.Characteristic.SerialNumber, this.api.systemInfo.systemSerial)
        .setCharacteristic(this.platform.Characteristic.HardwareFinish, 'PCS H/W Ver.: ' + this.api.systemInfo.PmsHW)
        .setCharacteristic(this.platform.Characteristic.HardwareRevision, ' PMS H/W Ver.: ' + this.api.systemInfo.PcsHW)
        .setCharacteristic(this.platform.Characteristic.FirmwareRevision, 'PCS S/W Ver.: ' + this.api.systemInfo.PmsSW)
        .setCharacteristic(this.platform.Characteristic.SoftwareRevision, 'PMS S/W Ver.: ' + this.api.systemInfo.PcsSW);
    }
    //add services based on config
    if (this.api.config.gridPower){
      const gridPowerService = this.accessory.getService('gridPower') ||
        this.accessory.addService(this.platform.Service.LightSensor, 'gridPower', 'gridPower');
      gridPowerService.setCharacteristic(this.platform.Characteristic.Name, 'gridPower');
      gridPowerService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
        .onGet(this.lightSensorBounds(this.getWebApiDataByType<number>('gridPower').bind(this)));

      const gridPowerBuyService = this.accessory.getService('gridPowerBuy') ||
      this.accessory.addService(this.platform.Service.Switch, 'gridPowerBuy', 'gridPowerBuy');
      gridPowerBuyService.setCharacteristic(this.platform.Characteristic.Name, 'gridPowerBuy');
      gridPowerBuyService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getWebApiDataByType<boolean>('flow.gridBuy').bind(this));
      const gridPowerSellService = this.accessory.getService('gridPowerSell') ||
      this.accessory.addService(this.platform.Service.Switch, 'gridPowerSell', 'gridPowerSell');
      gridPowerSellService.setCharacteristic(this.platform.Characteristic.Name, 'gridPowerSell');
      gridPowerSellService.getCharacteristic(this.platform.Characteristic.On)
        // ignoring flow.gridSellDischarging for this property
        .onGet(this.getWebApiDataByType<boolean>('flow.gridSellPv').bind(this));
    }

    if (this.api.config.batterySoc){
      const batterySocService = this.accessory.getService('batterySoc') ||
        this.accessory.addService(this.platform.Service.Battery, 'batterySoc', 'batterySoc');
      batterySocService.setCharacteristic(this.platform.Characteristic.Name, 'batterySoc');
      batterySocService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
        // don't trigger battery low warning
        .onGet(() => this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
      batterySocService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
        .onGet(() => this.getWebApiDataByType<number>('battery.soc').bind(this)());

      const batterySocAsLightService = this.accessory.getService('batterySocAsLight') ||
        this.accessory.addService(this.platform.Service.LightSensor, 'batterySocAsLight', 'batterySocAsLight');
      batterySocAsLightService.setCharacteristic(this.platform.Characteristic.Name, 'batterySocAsLight');
      batterySocAsLightService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
        .onGet(this.lightSensorBounds(this.getWebApiDataByType<number>('battery.soc').bind(this)));
    }

    if (this.api.config.loadPower){
      const loadPowerService = this.accessory.getService('loadPower') ||
        this.accessory.addService(this.platform.Service.LightSensor, 'loadPower', 'loadPower');
      loadPowerService.setCharacteristic(this.platform.Characteristic.Name, 'loadPower');
      loadPowerService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
        .onGet(this.lightSensorBounds(this.getWebApiDataByType<number>('loadPower').bind(this)));
    }
    if (this.api.config.pvPower){
      const pvPowerService = this.accessory.getService('pvPower') ||
        this.accessory.addService(this.platform.Service.LightSensor, 'pvPower', 'pvPower');
      pvPowerService.setCharacteristic(this.platform.Characteristic.Name, 'pvPower');
      pvPowerService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
        .onGet(this.lightSensorBounds(this.getWebApiDataByType<number>('pvPower').bind(this)));
    }

    if (this.api.config.batteryPower){
      const batteryPowerService = this.accessory.getService('batteryPower') ||
        this.accessory.addService(this.platform.Service.LightSensor, 'batteryPower', 'batteryPower');
      batteryPowerService.setCharacteristic(this.platform.Characteristic.Name, 'batteryPower');
      batteryPowerService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
        .onGet(this.lightSensorBounds(this.getWebApiDataByType<number>('battery.power').bind(this)));

      const batteryChargingService = this.accessory.getService('batteryCharging') ||
      this.accessory.addService(this.platform.Service.Switch, 'batteryCharging', 'batteryCharging');
      batteryChargingService.setCharacteristic(this.platform.Characteristic.Name, 'batteryCharging');
      batteryChargingService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(() => batteryNstatus.charging === this.getWebApiDataByType<number>('battery.nStatus').bind(this)());
      const batteryDischargingService = this.accessory.getService('batteryDischarging') ||
      this.accessory.addService(this.platform.Service.Switch, 'batteryDischarging', 'batteryDischarging');
      batteryDischargingService.setCharacteristic(this.platform.Characteristic.Name, 'batteryDischarging');
      batteryDischargingService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(() => batteryNstatus.discharging === this.getWebApiDataByType<number>('battery.nStatus').bind(this)());
    }

    if (this.api.config.updateMotionSensor){
      const updateMotionSensorService = this.accessory.getService('updateMotionSensor') ||
        this.accessory.addService(this.platform.Service.MotionSensor, 'updateMotionSensor', 'updateMotionSensor');
      api.on('dataUpdate', () => {
        this.log.debug('Triggering motion sensor on data update');
        updateMotionSensorService.updateCharacteristic(this.platform.Characteristic.MotionDetected, true);
        setTimeout(() => {
          updateMotionSensorService.updateCharacteristic(this.platform.Characteristic.MotionDetected, false);
        }, 5000);
      });
    }
  }

  getWebApiDataByType<T>(property: nestedByType<runningDataPoint, T>): () => T{
    return function(this: LgEnerVuPlatformAccessory): T{
      if (this.api.state < 2){
        this.log.info(`Data for ${property} not ready.`);
        throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }

      this.log.debug(`Reading ${property}`);
      const keys = property.split('.');
      let result = this.api.data;
      try {
        for (const key of keys) {
          result = result[key];
        }
        return result as T;

      } catch (error) {
        this.log.error(`Encountered unreadable API data: ${error}`);
        throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    }.bind(this);
  }

  lightSensorBounds(dataFunction: () => number): () => number{
    return () => Math.min(Math.max(dataFunction(), 0.1), 100000);
  }
}