// Data structures returned by webApi

export interface accountDetails{
  account?: {
    loginSessionID: string;
    userID: string;
    userIDType: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    country: string;
    countryName: string;
    email: string;
    blacklist: string;
    age: string;
    addr: string;
    postal: string;
    isSubscribe: string;
    isReceiveSms: string;
    mblPhnNo: string;
    changePw: string;
    toEmailId: string;
    periodPW: string;
    lgAccount: string;
    isService: string;
    termsList: [];
    userIDList: [userIDList];
    serviceList: [serviceList];
    displayUserID: string;
    notiList: { totCount: string; list: [] };
    authUser: string;
    dummyIdFlag: string;
    pwChgDatetime: string;
    lastLognDate: string;
    crtDate: string;
  };
  error?: { // login attempt failed
    request: string;
    code: string;
    message: string;
  };
}

interface userIDList{
  lgeIDList: [ {lgeIDType: string; userID: string } ];
}

interface serviceList{
    svcCode: string;
    svcName: string;
    isService: string;
    joinDate: string;
}

export interface systemInfo{
    systemName: string;
    systemSerial: string;
    PmsSW: string;
    PmsHW: string;
    PcsSW: string;
    PcsHW: string;
}

export interface RunningData {
    energyFlowList: Array<runningDataPoint>; // data recieved
    resultCode: string; // only when session expired
    resultMessage: string; // only when session expired
}

export interface runningDataPoint {
    systemId: number;
    essId: number;
    targetDate: string;
    timeMin: string;
    systemOperation: number;
    operationMode: number;
    aiMode: number;
    vppMode: number;
    operationSubMode: number;
    systemComp: number;
    winterMode: number;
    rippleControl: null;
    rippleControlStr: null;
    pvStatus: number;
    pvStatusStr: null;
    pvPower: number;
    loadPower: number;
    gridPower: number;
    systemOperationStr: string;
    operationModeStr: null;
    operationSubModeStr: null;
    icon: null;
    battery: runningDataPointBattery;
    flow: runningDataPointFlow;
    external: runningDataPointExternal;
    flowEx: runningDataPointflowEx;
    externalEx: null;
    pcs1: null;
    pcs2: null;
    pcs3: null;
    pcs4: null;
    evc: null;
    pcsEx1: null;
    pcsEx2: null;
    pcsEx3: null;
    pcsList: null;
    pcsExList: null;
    awhpElevelState: number;
    awhpOperMode: number;
    battStatus: number;
  }

export interface runningDataPointBattery{
    soc: number;
    nStatus: number; // indicates direction of power flow
    power: number;
    status: string;
    strStatus: string;
  }

export enum batteryNstatus{
  standby = 0,
  charging = 1,
  discharging = 2,
}

export interface runningDataPointFlow {
    directConsumption: boolean;
    batteryCharging: boolean;
    gridSellPv: boolean;
    batteryDischarging: boolean;
    gridSellDischarging: boolean;
    gridBuy: boolean;
    chargingFromGrid: boolean;
  }

export interface runningDataPointExternal{ // untested
    evChargerEnabled: boolean;
    evChargerConnected: boolean;
    evChargerPower: number;
    awhpEnabled: boolean;
    awhpConnected: boolean;
  }

export interface runningDataPointflowEx{
    directConsumption: number;
    batteryCharging: number;
    gridSellPv: number;
    batteryDischarging: number;
    gridBuy: number;
    chargingFromGrid: number;
    dischargingToGrid: number;
  }

export interface LgHeaders{
  'Accept': string;
  'Accept-Language': string;
  'Access-Control-Allow-Origin': string;
  'Content-Type': string;
  'User-Agent': string;
  'X-Application-Key': string;
  'X-Device-Country': string;
  'X-Device-Language': string;
  'X-Device-Language-Type': string;
  'X-Device-Platform': string;
  'X-Device-Publish-Flag': string;
  'X-Device-Type': string;
  'X-Lge-Svccode': string;
  'X-Signature': string;
  'X-Timestamp': string;
  'X-User-Agent': string;
  'X-User-Dvc-ID': string;
  'X-User-IP': string;
}