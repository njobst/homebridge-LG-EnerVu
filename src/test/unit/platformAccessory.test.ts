import {LgEnerVuPlatformAccessory} from '../../platformAccessory';
import { LgEnerVuApi } from '../../Api/webApi';
import { runningDataPoint } from '../../Api/interface';
import { Logger, HAPStatus } from 'homebridge';

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

type PartialExcept<T, K extends keyof T> = RecursivePartial<T> & Pick<T, K>;

describe('LgEnerVuPlatformAccessory', () => {
  const mockedApi: RecursivePartial<LgEnerVuApi> = {};

  const mockedLog: jest.Mocked<Logger> = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  };

  const accessoryTest: PartialExcept<LgEnerVuPlatformAccessory, 'getWebApiDataByType' | 'lightSensorBounds' > = {
    getWebApiDataByType: LgEnerVuPlatformAccessory.prototype.getWebApiDataByType,
    lightSensorBounds: LgEnerVuPlatformAccessory.prototype.lightSensorBounds,
    api: mockedApi,
    log: mockedLog,
    platform:  {api: {hap: {HapStatusError: jest.fn(() => Error(String(HAPStatus.SERVICE_COMMUNICATION_FAILURE)))}}},
  };

  describe('getWebApiDataByType', () => {

    it('extract a number', () => {
      mockedApi.data = {'battery':{'nStatus': 5}} as runningDataPoint;
      mockedApi.state = 2;
      const result = accessoryTest.getWebApiDataByType<number>('battery.nStatus')();
      expect(typeof result).toBe('number');
      expect(result).toBe(5);
    });

    it('extract a boolean', () => {
      mockedApi.data = {'flow':{'gridBuy': true}} as runningDataPoint;
      mockedApi.state = 2;
      const result = accessoryTest.getWebApiDataByType!<boolean>('flow.gridBuy')();
      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
    });

    it('throw error on no data api state', () => {
      mockedApi.state = 1;
      expect(accessoryTest.getWebApiDataByType!<boolean>('flow.gridBuy')).toThrow(Error(String(HAPStatus.SERVICE_COMMUNICATION_FAILURE)));
    });

    it('handle data in api missing', () => {
      mockedApi.state = 2;
      mockedApi.data = {} as runningDataPoint;
      expect(accessoryTest.getWebApiDataByType!<boolean>('flow.gridBuy')).toThrow(Error(String(HAPStatus.SERVICE_COMMUNICATION_FAILURE)));
    });
  });

  describe('lightSensorBounds', () => {

    it('enforce lower bound to 0.1', () => {
      const result = accessoryTest.lightSensorBounds(() => 0)();
      expect(result).toBe(0.1);
    });

    it('enforce upper bound to 100000', () => {
      const result = accessoryTest.lightSensorBounds(() => 1E10)();
      expect(result).toBe(100000);
    });

  });
});