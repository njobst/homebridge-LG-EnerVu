import { runningDataPoint, accountDetails, systemInfo, RunningData } from './interface';
import { LgEnerVuPlatformConfig, homebridgePlatformConfig } from '../config';
import { Logger } from 'homebridge';
import * as crypto from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { EventEmitter } from 'events';
import {setTimeout} from 'timers/promises';


enum state{
  badLogin = -1, // No further connection attempts will be made
  Starting = 0, // No data available yet
  Error = 1, // => attempting to create new session
  Active = 2, // Data available
}

export class LgEnerVuApi extends EventEmitter {
  public readonly config: LgEnerVuPlatformConfig;
  private log: Logger;

  private cyclesSinceRefresh = 0;
  private staleDataCycles = 0;
  private filePath = '';

  public data!: runningDataPoint;
  public systemInfo?: systemInfo;
  public state: state;

  constructor(config: LgEnerVuPlatformConfig, log: Logger, filePath: string) {
    super();
    this.filePath = filePath;
    this.config = config;
    this.log = log;

    this.state = state.Starting;
    this.cyclesSinceRefresh = 0;
  }

  async initialize(): Promise<void> {

    try {
      let response = await fetch('https://de.lgaccount.com/login/sign_in');
      const txt = await response.text();
      if (txt.search('signatureG') === -1 || txt.search('timestampG') === -1){
        throw new Error('Failed to generate login signature');
      }
      const signature = txt.substring(txt.search('signatureG')+28, txt.search('signatureG')+72);
      const timestamp = txt.substring(txt.search('timestampG')+28, txt.search('timestampG')+38);
      this.log.debug('Login attempt signature: ' + signature, timestamp);

      response = await fetch('https://de.emp.lgsmartplatform.com/emp/v2.0/account/session/'+encodeURIComponent(this.config.user.email), {
        'body': 'user_auth2=' + crypto.createHash('sha512').update(this.config.user.password).digest('hex')+
          '&svc_list=SVC951&itg_user_type=A&inactive_policy=Y&cnct_regn=',
        'cache': 'default',
        'credentials': 'include',
        'headers': {
          'Accept': 'application/json',
          'Accept-Language': this.config.language + ',' + this.config.language.slice(0, 2) + ';q=0.9',
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': this.config.userAgent,
          'X-Application-Key': '6V1V8H2BN5P9ZQGOI5DAQ92YZBDO3EK9',
          'X-Device-Country': this.config.language.slice(-2),
          'X-Device-Language': this.config.language,
          'X-Device-Language-Type': 'IETF',
          'X-Device-Platform': 'PC',
          'X-Device-Publish-Flag': 'Y',
          'X-Device-Type': 'P01',
          'X-Lge-Svccode': 'SVC709',
          'X-Signature': signature,
          'X-Timestamp': timestamp,
          'X-User-Agent': this.config.userAgent,
          'X-User-Dvc-ID': '',
        },
        'method': 'POST',
        'mode': 'cors',
        'redirect': 'follow',
        'referrer': 'https://de.lgaccount.com/',
      });
      const json = await response.json() as accountDetails;
      if (json.error !== undefined){ // login attempt failed
        this.log.error('Login failed: '
          +json.error.message+'. After 5 wrong password attempts the account needs to be unlocked via e-mail. Stopping Plugin');
        this.state = state.badLogin; // prevent further attempts
        return;
      }
      if (json.account?.loginSessionID === undefined){
        throw new Error('Failed to generate Login Session ID');
      }
      const loginSessionID = json.account.loginSessionID.replaceAll(';', '%253B'); //these seem to get encoded twice :)
      this.log.debug('Login Session ID: '+loginSessionID);

      response = await fetch('https://enervu.lg-ess.com/v2/homeowner/account/login?sid='+loginSessionID, {
        'credentials':'include',
        'headers':{
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://de.lgaccount.com/',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Connection': 'keep-alive',
          'User-Agent':
            this.config.userAgent,
        },
        redirect: 'manual', // redirect doesnt add required Cookie
      });
      const set_cookie = response.headers.get('set-cookie');
      if (set_cookie === null || set_cookie.search('JSESSIONID') === -1 ||
          set_cookie.search('AWSELB') === -1 || set_cookie.search('AWSELBCOR') === -1){
        throw new Error('No valid Cookie was returned from Login');
      }
      this.config.userAgent;
      const jsessionid = set_cookie.substring(set_cookie.search('JSESSIONID'), set_cookie.search('JSESSIONID')+55) + '; ';
      const awselb = set_cookie.substring(set_cookie.search('AWSELB'), set_cookie.search('AWSELB')+145) + '; ';
      const awselbcor = set_cookie.substring(set_cookie.search('AWSELBCOR'), set_cookie.search('AWSELBCOR')+149) + '; ';
      this.config.sessionData.Cookie = jsessionid+'lang=de; country=DE; ctCode=DE; '+awselb+awselbcor+'enervuCookieCompliance=on';
      this.log.debug('Generated Cookie: '+this.config.sessionData.Cookie);

      response = await fetch('https://enervu.lg-ess.com/v2/homeowner/main.do?page=dashboard', {
        'cache': 'default',
        'credentials': 'include',
        'headers': {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': this.config.language + ',' + this.config.language.slice(0, 2) + ';q=0.9',
          'User-Agent': this.config.userAgent,
          Cookie: this.config.sessionData.Cookie,
        },
        'method': 'GET',
        'mode': 'cors',
        'redirect': 'follow',
        'referrer': 'https://de.lgaccount.com/',
        'referrerPolicy': 'strict-origin-when-cross-origin',
      });
      const text = await response.text();
      if (text.search('system_id') === -1){
        throw new Error('Unexpected data in main landing page');
      }
      this.config.sessionData.system_id = text.substring(text.search('system_id')+11, text.search('system_id')+15);
      this.log.debug('System ID: '+ this.config.sessionData.system_id);

      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
      const yyyy = today.getFullYear();
      response = await fetch(
        'https://enervu.lg-ess.com/v2/homeowner/systems/'+this.config.sessionData.system_id+'/dashboard.do?today='+yyyy+mm+dd, {
          'cache': 'default',
          'credentials': 'include',
          'headers': {
            'Accept': 'text/html, */*; q=0.01',
            'Accept-Language':
              this.config.language + ',' + this.config.language.slice(0, 2) + ';q=0.9',
            'User-Agent': this.config.userAgent,
            'X-Requested-With': 'XMLHttpRequest',
            Cookie: this.config.sessionData.Cookie,
            'Connection': 'keep-alive',
          },
          'method': 'GET',
          'mode': 'cors',
          'redirect': 'follow',
          'referrer': 'https://enervu.lg-ess.com/v2/homeowner/main.do?page=dashboard',
          'referrerPolicy': 'strict-origin-when-cross-origin',
        });
      const dashboardResponse = await response.text();
      if (dashboardResponse.search('ess_id') === -1){
        throw new Error('Unexpected data on dashboard');
      }
      this.config.sessionData.ess_id =
        dashboardResponse.substring(dashboardResponse.search('ess_id')+8, dashboardResponse.search('ess_id')+12);
      this.log.debug('ESS ID: '+ this.config.sessionData.ess_id);

      this.log.info('Logged in successfully');

    } catch (error) {
      this.log.error('Error during login process: '+ error);
      this.state = state.Error;
      return;
    }

    await this.refresh();
    this.updateConfig();

    if (this.systemInfo === undefined) {
      await this.getSystemInfo();
    }
    return;

  }

  async getSystemInfo(): Promise<void>{
    try {
      const response = await fetch('https://enervu.lg-ess.com/v2/homeowner/systems/'+this.config.sessionData.system_id+'/system-info.do', {
        'cache': 'default',
        'credentials': 'include',
        'headers': {
          'Accept': 'text/html, */*; q=0.01',
          'Accept-Language': this.config.language + ',' + this.config.language.slice(0, 2) + ';q=0.9',
          'User-Agent': this.config.userAgent,
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: this.config.sessionData.Cookie,
        },
        'method': 'GET',
        'mode': 'cors',
        'redirect': 'follow',
        'referrer': 'https://enervu.lg-ess.com/v2/homeowner/main.do?page=systemInfo',
        'referrerPolicy': 'strict-origin-when-cross-origin',
      });
      const systemInfoHtml = await response.text();
      this.systemInfo = this.extractSystemInfo(systemInfoHtml);
      this.log.debug('Updated SystemInfo');
    } catch (error) {
      this.log.error('Error while getting system info: '+ error);
      this.state = state.Error;
      return;
    }
  }

  extractSystemInfo(html: string): (systemInfo | undefined){
    const maxDataLength = 100;
    const essInfoClass = html.substring(html.search('essInfoItem'), html.search('essInfoItem')+ 1500);

    let classOffset = html.search('site_i ess');
    let dataOffset = 44;
    const systemName = html.substring(classOffset+dataOffset,
      html.substring(classOffset+dataOffset, classOffset+dataOffset+maxDataLength).search('<')+classOffset+dataOffset);
    classOffset = essInfoClass.search('<span class="tit">');
    dataOffset = 18;
    const systemSerial = essInfoClass.substring(classOffset+dataOffset,
      essInfoClass.substring(classOffset+dataOffset, classOffset+dataOffset+maxDataLength).search('<')+classOffset+dataOffset);
    classOffset = essInfoClass.search('PMS S/W Ver.');
    dataOffset = 83;
    const systemPmsSW = essInfoClass.substring(classOffset+dataOffset,
      essInfoClass.substring(classOffset+dataOffset, classOffset+dataOffset+maxDataLength).search('<')+classOffset+dataOffset);
    classOffset = essInfoClass.search('PMS H/W Ver.');
    dataOffset = 83;
    const systemPmsHW = essInfoClass.substring(classOffset+dataOffset,
      essInfoClass.substring(classOffset+dataOffset, classOffset+dataOffset+maxDataLength).search('<')+classOffset+dataOffset);
    classOffset = essInfoClass.search('PCS S/W Ver.');
    dataOffset = 81;
    const systemPcsSW = essInfoClass.substring(classOffset+dataOffset,
      essInfoClass.substring(classOffset+dataOffset, classOffset+dataOffset+maxDataLength).search('<')+classOffset+dataOffset);
    classOffset = essInfoClass.search('PCS H/W Ver.');
    dataOffset = 83;
    const systemPcsHW = essInfoClass.substring(classOffset+dataOffset,
      essInfoClass.substring(classOffset+dataOffset, classOffset+dataOffset+maxDataLength).search('<')+classOffset+dataOffset);
    if (systemName === '' && systemSerial === '' && systemPmsSW === '' && systemPmsHW === '' && systemPcsSW === '' && systemPcsHW === ''){
      return undefined;
    } else {
      return {
        systemSerial: systemSerial || '_',
        systemName: systemName || '-',
        PmsSW: systemPmsSW || '-',
        PmsHW: systemPmsHW || '-',
        PcsSW: systemPcsSW || '-',
        PcsHW: systemPcsHW || '-',
      } as systemInfo;
    }
  }

  async update(): Promise<void> {
    this.cyclesSinceRefresh += 1;
    this.log.debug('Minutes since last refresh: ' +
      Math.round(this.cyclesSinceRefresh*(this.config.refreshTimeInMinutes*10))/10); // round to .1 minutes
    if (((this.cyclesSinceRefresh+1)*this.config.refreshTimeInMinutes) >= 59){ // next refresh is past session timeout
      this.log.debug('Refreshing site to extend session');
      await this.refresh();
      return;
    }
    try {
      const response = await fetch('https://enervu.lg-ess.com/v2/homeowner/systems/ess/energyflow-info', {
        body: 'system_id='+this.config.sessionData.system_id+'&ess_id='+this.config.sessionData.ess_id,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Sec-Fetch-Site': 'same-origin',
          'Accept-Language': this.config.language + ',' + this.config.language.slice(0, 2) + ';q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Mode': 'cors',
          Host: 'enervu.lg-ess.com',
          Origin: 'https://enervu.lg-ess.com',
          'Content-Length': '26',
          'User-Agent':
            this.config.userAgent,
          Referer: 'https://enervu.lg-ess.com/v2/homeowner/main.do?page=dashboard',
          Connection: 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          Cookie: this.config.sessionData.Cookie,
        },
        method: 'POST',
      });
      let energyflowInfoJson = await response.json() as RunningData;
      if (energyflowInfoJson.energyFlowList === undefined){
        let message = 'Failed to read result message';
        if (energyflowInfoJson.resultMessage !== undefined) {
          message = energyflowInfoJson.resultMessage;
        }
        throw new Error('Failed to read energyflow-info data. Message: ' + message);
      }
      if (this.data?.targetDate === energyflowInfoJson.energyFlowList[0]?.targetDate){
        this.staleDataCycles += 1;
        this.log.debug('Did not update data: Recieved existing data again.');
        if (this.staleDataCycles >= 5){
          this.log.warn(`No data updates from the ESS for ${this.staleDataCycles} cycles. You might want to check its connection.`);
        }
      } else{
        if (!this.config.latestDataForPower){
          energyflowInfoJson = this.averageData(energyflowInfoJson);
        }
        this.data = energyflowInfoJson.energyFlowList[0]; // pick the newest available data
        this.staleDataCycles = 0;
        this.emit('dataUpdate');
        this.log.debug('Updated data: '+this.data?.targetDate);
      }
      this.state = state.Active;
    } catch (error) {
      this.log.error('Error during update process: '+ error);
      this.state = state.Error;
      return;
    }
  }

  averageData(dataJson: RunningData): RunningData{
    dataJson.energyFlowList[0].gridPower =
      (dataJson.energyFlowList[0].gridPower + dataJson.energyFlowList[1].gridPower + dataJson.energyFlowList[2].gridPower +
      dataJson.energyFlowList[3].gridPower + dataJson.energyFlowList[4].gridPower + dataJson.energyFlowList[5].gridPower) /6;
    dataJson.energyFlowList[0].loadPower =
      (dataJson.energyFlowList[0].loadPower + dataJson.energyFlowList[1].loadPower + dataJson.energyFlowList[2].loadPower +
      dataJson.energyFlowList[3].loadPower + dataJson.energyFlowList[4].loadPower + dataJson.energyFlowList[5].loadPower) /6;
    dataJson.energyFlowList[0].battery.power =
      (dataJson.energyFlowList[0].battery.power + dataJson.energyFlowList[1].battery.power + dataJson.energyFlowList[2].battery.power +
      dataJson.energyFlowList[3].battery.power + dataJson.energyFlowList[4].battery.power + dataJson.energyFlowList[5].battery.power) /6;
    dataJson.energyFlowList[1].pvPower =
      (dataJson.energyFlowList[0].pvPower + dataJson.energyFlowList[1].pvPower + dataJson.energyFlowList[2].pvPower +
      dataJson.energyFlowList[3].pvPower + dataJson.energyFlowList[4].pvPower + dataJson.energyFlowList[5].pvPower) /6;
    return dataJson;
  }

  async refresh(): Promise<void> {
    try {
      // Optional: Reload dashboard - pretend to reload the site
      let response = await fetch('https://enervu.lg-ess.com/v2/homeowner/main.do?page=dashboard', {
        'cache': 'default',
        'credentials': 'include',
        'headers': {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': this.config.language + ',' + this.config.language.slice(0, 2) + ';q=0.9',
          'User-Agent': this.config.userAgent,
          Cookie: this.config.sessionData.Cookie,
        },
        'method': 'GET',
        'mode': 'cors',
        'redirect': 'follow',
        'referrer': 'https://de.lgaccount.com/',
        'referrerPolicy': 'strict-origin-when-cross-origin',
      });
      const text = await response.text();
      if (text.search(this.config.user.email) === -1){
        throw new Error('Unexpected data when loading dashboard');
      }
      this.log.debug('Extended session');

      // Initial request with Start_Poll header
      response = await fetch('https://enervu.lg-ess.com/v2/homeowner/systems/ess/energyflow-info', {
        body: 'system_id=5532&ess_id=4920',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Sec-Fetch-Site': 'same-origin',
          'Accept-Language': this.config.language + ',' + this.config.language.slice(0, 2) + ';q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Mode': 'cors',
          Host: 'enervu.lg-ess.com',
          Origin: 'https://enervu.lg-ess.com',
          'Content-Length': '26',
          'User-Agent': this.config.userAgent,
          Referer: 'https://enervu.lg-ess.com/v2/homeowner/main.do?page=dashboard',
          Connection: 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          Cookie: this.config.sessionData.Cookie,
          START_POLL: 'Y',
        },
        method: 'POST',
      });
      let energyflowInfoJson = await response.json();
      if (energyflowInfoJson.energyFlowList === undefined){
        let message = 'Failed to read result message';
        if (energyflowInfoJson.resultMessage !== undefined) {
          message = energyflowInfoJson.resultMessage;
        }
        throw new Error('Failed to open energyflow-info session. Message: ' + message);
      }
      if (!this.config.latestDataForPower){
        energyflowInfoJson = this.averageData(energyflowInfoJson);
      }
      this.data = energyflowInfoJson.energyFlowList[0] as runningDataPoint;
      this.state = state.Active;
      this.log.debug('Updated data: '+this.data?.targetDate);
      this.cyclesSinceRefresh = 0;

    } catch (error) {
      this.log.error('Error during refresh process: '+ error);
      this.state = state.Error;
      return;
    }
  }

  async updateConfig(): Promise<void> {
    try {
      const oldHomebridgeConfig: homebridgePlatformConfig = JSON.parse(
        readFileSync(this.filePath).toString(),
      );
      for (const platform of oldHomebridgeConfig.platforms){
        if (platform.platform === 'LgEnerVu'){
          platform.sessionData = this.config.sessionData;
          writeFileSync(this.filePath, JSON.stringify(oldHomebridgeConfig));
          this.log.debug('Updated config to represent current session, Cookie: '+ this.config.sessionData.Cookie);
          return;
        }
      }
      this.log.error('Failed to update config with new Cookie');
    } catch (error) {
      this.log.info('An error occured while updating the config with the new Cookie: '+ error);
      return;
    }
  }

  async readConfig(): Promise<boolean>{
    try {
      const lgEnervuContext: homebridgePlatformConfig = JSON.parse(
        readFileSync(this.filePath).toString(),
      );
      for (const platform of lgEnervuContext.platforms){
        if (platform.platform === 'LgEnerVu'){
          if (platform.sessionData?.Cookie && platform.sessionData?.ess_id && platform.sessionData?.system_id) {
            this.log.info('Importing session data');
            this.config.sessionData.Cookie = platform.sessionData.Cookie;
            this.config.sessionData.ess_id = platform.sessionData.ess_id;
            this.config.sessionData.system_id = platform.sessionData.system_id;
            return true;
          }
        }
      }
      this.log.info('No or invalid session data stored. Starting with a new session.');
      return false;
    } catch (_) {
      this.log.info('No or invalid session data stored. Starting with a new session.');
      return false;
    }
  }

  async start(){
    if (!(await this.readConfig())){
      await this.initialize();
    } else{
      await this.refresh(); // time since last refresh is unknown
    }
    if(this.state === state.badLogin){
      return; // hault API on wrong password attempt to avoid locking the account
    }

    let timeout = 10 * 1000; // 30s
    while (this.state === state.Error){
      this.log.debug(`Login failed. Trying again in ${timeout/1000} seconds`);
      await setTimeout(timeout);
      this.state = state.badLogin; // prevent control flow error
      await this.initialize();
      if(this.state === state.badLogin){
        return; // hault API on wrong password attempt to avoid locking the account
      }
      timeout = timeout * 2;
    }
    this.log.info('Login successful');
    this.emit('firstLogin');
    this.loop();
  }

  async loop(){
    // Always query 25 seconds after a minute rolls over - most reliable for me
    await setTimeout((85-(Date.now()/1000%60))*1000);
    const interval = setInterval(() =>{
      switch(this.state){
        case state.badLogin:
          clearInterval(interval);
          break;
        case state.Error:
          this.initialize();
          break;
        case state.Active:
          this.update();
          break;
      }
    }, this.config.refreshTimeInMinutes*60000);
  }

  _injectTestSetup(cookie = '', system_id = '', ess_id = '', refreshTime = 1, cyclesSinceRefresh = 0): void {
    this.config.sessionData.Cookie = cookie;
    this.config.sessionData.system_id = system_id;
    this.config.sessionData.ess_id = ess_id;
    this.config.refreshTimeInMinutes = refreshTime;
    this.cyclesSinceRefresh = cyclesSinceRefresh;
  }

  _returnTestData(): [string, string, string, number]{
    return [this.config.sessionData.Cookie, this.config.sessionData.system_id, this.config.sessionData.ess_id, this.cyclesSinceRefresh];
  }

}