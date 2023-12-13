import {LgEnerVuApi} from '../../Api/webApi';
import * as fs from 'fs';
import * as path from 'path';
import { systemInfo, RunningData, runningDataPoint } from '../../Api/interface';
import { LgEnerVuPlatformConfig, sessionData } from '../../config';
import { Logger } from 'homebridge';

describe('LgEnerVuApi', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    errorMessage = '';
    api._injectTestSetup();
  });

  const config = new LgEnerVuPlatformConfig();
  config.user = {email: 'test@test.com', password: 'test'};
  config.latestDataForPower = true;
  config.language = 'de-DE';
  config.userAgent = 'Test';
  config.sessionData = {} as sessionData;
  let errorMessage: string;
  const mockedLog: jest.Mocked<Logger> = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn((message) => {
      errorMessage = message; return;
    }),
    debug: jest.fn(),
    log: jest.fn(),
  };

  const api = new LgEnerVuApi(config, mockedLog, '');
  const mockedFetch = jest.spyOn(global, 'fetch')
    .mockImplementationOnce(jest.fn(() => Promise.resolve({
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
    })) as jest.Mock,
    );
  const textResponse = fs.readFileSync(path.resolve(__dirname+'/supplementary', 'webApi.txt'), 'utf8');
  const cookie = textResponse.substring(0, 432);
  const cookieResponse = textResponse.substring(434, 846);

  describe('initialize', () => {

    it('return error when no signature is found on sign in', async () => {
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve('')})) as jest.Mock );

      await api.initialize();

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(mockedFetch.mock.calls[0][0]).toBe('https://de.lgaccount.com/login/sign_in');
      expect(api.state).toBe(1);
      expect(errorMessage).toBe('Error during login process: Error: Failed to generate login signature');
    });

    it('use sign in signature & return error on session creation when no Session ID is found', async () => {
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () => Promise.resolve({})})) as jest.Mock );
      await api.initialize();

      expect(api.state).toBe(1);
      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(mockedFetch.mock.calls[1][0]).toBe('https://de.emp.lgsmartplatform.com/emp/v2.0/account/session/test%40test.com');
      expect(mockedFetch.mock.calls[1][1]?.headers!['X-Timestamp']).toBe('9999999999');
      expect(mockedFetch.mock.calls[1][1]?.headers!['X-Signature']).toBe('whoWouldEvenBotherToReadThis1gh+yM0XvRgIKik=');
      expect(mockedFetch.mock.calls[1][1]?.headers!['Accept-Language']).toBe('de-DE,de;q=0.9');

      expect(errorMessage).toBe('Error during login process: Error: Failed to generate Login Session ID');
    });

    it('stop API on wrong password attempt', async () => {
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() =>
        Promise.resolve({ json: () => Promise.resolve({error: {message: 'Test'}})})) as jest.Mock );

      await api.initialize();

      expect(api.state).toBe(-1);
      expect(errorMessage).toBe('Login failed: Test. After 5 wrong password attempts the account needs to be unlocked via e-mail.' +
        ' Stopping Plugin');
    });

    it('use session ID & return error on login when no cookie is returned', async () => {
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () =>
        Promise.resolve({account: {loginSessionID: 'emp;1701370721248;000044611'}})})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ headers: new Headers()})) as jest.Mock );

      await api.initialize();

      expect(api.state).toBe(1);
      expect(mockedFetch).toHaveBeenCalledTimes(3);
      expect(mockedFetch.mock.calls[2][0]).toBe(
        'https://enervu.lg-ess.com/v2/homeowner/account/login?sid=emp%253B1701370721248%253B000044611');
      expect(errorMessage).toBe('Error during login process: Error: No valid Cookie was returned from Login');
    });

    it('use cookie & return error on landing page when no system id is returned', async () => {
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () =>
        Promise.resolve({account: {loginSessionID: 'emp;1701370721248;000044611'}})})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ headers: new Headers({'set-cookie': cookie})})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve('')})) as jest.Mock );

      await api.initialize();

      expect(api.state).toBe(1);
      expect(mockedFetch).toHaveBeenCalledTimes(4);
      expect(mockedFetch.mock.calls[3][1]?.headers!['Cookie']).toBe(cookieResponse);
      expect(errorMessage).toBe('Error during login process: Error: Unexpected data in main landing page');
    });

    it('use system ID & return error on dashboard when no ess id is returned', async () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
      const yyyy = today.getFullYear();

      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () =>
        Promise.resolve({account: {loginSessionID: 'emp;1701370721248;000044611'}})})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ headers: new Headers({'set-cookie': cookie})})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve('')})) as jest.Mock );

      await api.initialize();

      expect(errorMessage).toBe('Error during login process: Error: Unexpected data on dashboard');
      expect(api.state).toBe(1);
      expect(mockedFetch).toHaveBeenCalledTimes(5);
      expect(api._returnTestData()[1]).toBe('1234');
      expect(mockedFetch.mock.calls[4][0]).toBe('https://enervu.lg-ess.com/v2/homeowner/systems/1234/dashboard.do?today='+yyyy+mm+dd);
    });

    it('use ess ID & return status Active on Success', async () => {
      jest.spyOn(api, 'getSystemInfo').mockImplementationOnce(jest.fn());
      const mockedRefresh = jest.spyOn(api, 'refresh').mockImplementationOnce(jest.fn(() => {
        api.state = 2;
        return Promise.resolve();
      }));
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () =>
        Promise.resolve({account: {loginSessionID: 'emp;1701370721248;000044611'}})})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ headers: new Headers({'set-cookie': cookie})})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );

      await api.initialize();

      expect(mockedFetch).toHaveBeenCalledTimes(5);
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
      expect(api._returnTestData()[2]).toBe('5678');
      expect(api.state).toBe(2);
    });
  });

  describe('refresh', () => {
    it('use cookie & return error on dashboard when refresh dashboard load fails', async () => {
      api._injectTestSetup(cookieResponse);
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve('')})) as jest.Mock );

      await api.refresh();

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(mockedFetch.mock.calls[0][1]?.headers!['Cookie']).toBe(cookieResponse);
      expect(errorMessage).toBe('Error during refresh process: Error: Unexpected data when loading dashboard');
      expect(api.state).toBe(1);
    });

    it('use Start_Poll & return error default message when energyflow session returns no message', async () => {
      api._injectTestSetup(cookieResponse);
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () => Promise.resolve({})})) as jest.Mock );

      await api.refresh();

      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(mockedFetch.mock.calls[1][1]?.headers!['START_POLL']).toBe('Y');
      expect(errorMessage).toBe(
        'Error during refresh process: Error: Failed to open energyflow-info session. Message: Failed to read result message');
      expect(api.state).toBe(1);
    });

    it('return error message when energyflow session returns fault message', async () => {
      api._injectTestSetup(cookieResponse);
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () => Promise.resolve({resultMessage: 'X'})})) as jest.Mock);

      await api.refresh();

      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(errorMessage).toBe(
        'Error during refresh process: Error: Failed to open energyflow-info session. Message: X');
      expect(api.state).toBe(1);
    });

    it('update data on successful refresh', async () => {
      api._injectTestSetup(cookieResponse, undefined, undefined, undefined, 30);
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () => Promise.resolve(
        {energyFlowList: [{targetDate: 'tomorrow'}]})})) as jest.Mock);

      await api.refresh();

      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(api.data.targetDate).toBe('tomorrow');
      expect(errorMessage).toBe('');
      expect(api.state).toBe(2);
      expect(api._returnTestData()[3]).toBe(0);
    });
  });

  describe('update', () => {
    it('trigger refresh when next update exceeds session time', async () => {
      api._injectTestSetup(undefined, undefined, undefined, undefined, 60);
      const mockedRefresh = jest.spyOn(api, 'refresh')
        .mockReset()
        .mockImplementationOnce(jest.fn(() => {
          api.state = 2;
          return Promise.resolve();
        }));

      await api.update();

      expect(mockedRefresh).toHaveBeenCalledTimes(1);
      expect(api.state).toBe(2);
    });

    it('use cookie & return error on dashboard when refresh dashboard load fails', async () => {
      api._injectTestSetup(cookieResponse, undefined, undefined, undefined, 0);
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () => Promise.resolve({})})) as jest.Mock );

      await api.update();

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(mockedFetch.mock.calls[0][1]?.headers!['START_POLL']).toBe(undefined);
      expect(mockedFetch.mock.calls[0][1]?.headers!['Cookie']).toBe(cookieResponse);
      expect(errorMessage).toBe(
        'Error during update process: Error: Failed to read energyflow-info data. Message: Failed to read result message');
      expect(api.state).toBe(1);
    });

    it('return error message when energyflow session returns fault message', async () => {
      api._injectTestSetup(cookieResponse);
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () => Promise.resolve({resultMessage: 'X'})})) as jest.Mock);

      await api.update();

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(errorMessage).toBe(
        'Error during update process: Error: Failed to read energyflow-info data. Message: X');
      expect(api.state).toBe(1);
    });

    it('update data on successful refresh', async () => {
      api._injectTestSetup(cookieResponse);
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ json: () => Promise.resolve(
        {energyFlowList: [{targetDate: 'tomorrow'}]})})) as jest.Mock);

      await api.update();

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(errorMessage).toBe('');
      expect(api.data.targetDate).toBe('tomorrow');
      expect(api.state).toBe(2);
      expect(api._returnTestData()[3]).toBe(1);
    });
  });

  describe('getSystemInfo', () => {

    it('update data on successful fetch', async () => {
      api._injectTestSetup(cookieResponse, '1234');
      mockedFetch.mockImplementationOnce(jest.fn(() => Promise.resolve({ text: () => Promise.resolve(textResponse)})) as jest.Mock );
      const mockedExtractSystemInfo = jest.spyOn(api, 'extractSystemInfo').mockImplementationOnce(jest.fn(() => {
        return {'systemName': 'Test'} as systemInfo;
      }) as jest.Mock);

      await api.getSystemInfo();

      expect(mockedExtractSystemInfo).toHaveBeenCalledTimes(1);
      expect(mockedFetch.mock.calls[0][0]).toBe('https://enervu.lg-ess.com/v2/homeowner/systems/1234/system-info.do');
      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(mockedExtractSystemInfo.mock.calls[0][0]).toBe(textResponse);
      expect(api.systemInfo?.systemName).toBe('Test');
    });
  });

  describe('extractSystemInfo', () => {
    it('extract system parameters from html string', () => {
      const htmlString = fs.readFileSync(path.resolve(__dirname+'/supplementary', 'webApi.txt'), 'utf8');
      const systemInfo = api.extractSystemInfo(htmlString);
      const exampleSystemInfo = {
        systemName: 'LG ESS',
        systemSerial: 'ESS  ExampleABC',
        PmsSW: '12.34.5678',
        PmsHW: 'Rev 1.0',
        PcsSW: 'LG 12.34.56.78 R901 2.345.6',
        PcsHW: '-',
      } as systemInfo;
      expect(systemInfo).toStrictEqual(exampleSystemInfo);
    });

    it('return unknown if no values are found', () => {
      const htmlString = '';
      const systemInfo = api.extractSystemInfo(htmlString);
      expect(systemInfo).toBe(undefined);
    });
  });

  describe('averageData', () => {
    it('return average for gridPower, pvPower, loadPower, batteryPower', () => {
      const dataPoint1 = {gridPower: 5, pvPower: 5, loadPower: 5, battery: {power: 1}} as runningDataPoint;
      const dataPoint2 = {gridPower: 10, pvPower: 5, loadPower: 15, battery: {power: 2}} as runningDataPoint;
      const dataPoint3 = {gridPower: 15, pvPower: 5, loadPower: 25, battery: {power: 3}} as runningDataPoint;
      const dataPoint4 = {gridPower: 20, pvPower: 5, loadPower: 35, battery: {power: 4}} as runningDataPoint;
      const dataPoint5 = {gridPower: 25, pvPower: 5, loadPower: 45, battery: {power: 5}} as runningDataPoint;
      const dataPoint6 = {gridPower: 30, pvPower: 5, loadPower: 55, battery: {power: 6}} as runningDataPoint;
      const dataPointResult = {gridPower: 17.5, pvPower: 5, loadPower: 30, battery: {power: 3.5}} as runningDataPoint;
      const data = {energyFlowList: [dataPoint1, dataPoint2, dataPoint3, dataPoint4, dataPoint5, dataPoint6]} as RunningData;

      const result = api.averageData(data);

      expect(result).toStrictEqual(
        {energyFlowList: [dataPointResult, dataPoint2, dataPoint3, dataPoint4, dataPoint5, dataPoint6]} as RunningData);
    });
  });

});
