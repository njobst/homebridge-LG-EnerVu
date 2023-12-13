<p align="center">

<img src="Homebridge_x_ESS.png" width="400">

</p>

<span align="center">

# Homebridge LG EnerVu
[![Downloads](https://img.shields.io/npm/dt/homebridge-lg-enervu)](https://www.npmjs.com/package/homebridge-lg-enervu)
[![Version](https://img.shields.io/npm/v/homebridge-lg-enervu)](https://www.npmjs.com/package/homebridge-lg-enervu)

</span>

[Homebridge](https://github.com/nfarina/homebridge) plugin to enable home automation based on 
[LG EnerVu](https://enervu.lg-ess.com/v2/homeowner/index.do) data.

## Introduction

As LG doesn't offer an official API, this Plugin creates a web session to access the ESS data, similar to logging in on your browser. The cloud data is updated every 60 seconds by the ESS with data for the previous minute. You can chose to select data for the last ten seconds or the whole minute. The upload and processing time on LG's servers result in a delay between 25 to 85 seconds from actual change to it being reflected in Homekit.\
**Disclaimer**: This plugin is not endorsed by LG. It aims to mimic the communication between your browser and the server during an actual session, but I don't take any responsibility for your account being banned as a result of using this plugin. I do however use this myself and have not had any issues.

## Installation

Make sure you can access your [ESS data on the web](https://enervu.lg-ess.com/v2/homeowner/index.do) using your email and password.
Then install the Homebridge LG EnerVu plugin through Homebridge Config UI X or manually by:
  ```
  $ sudo npm -g i homebridge-lg-enervu
  ```

To update Homebridge LG EnerVu:, simply issue another `sudo npm -g i homebridge-lg-enervu@latest`.

## Configuration

It is highly recommended that you use Homebridge Config UI X and configure this plugin, using your email and password. Alternatively, you can edit and add the following configuration inside "platforms" in your config.json file. If you don't want to use your credentials, see [here](#session-data). Below you can find the minimum required config.

### Base Config

```json
    "platforms": [
        {
            "name": "LG EnerVu",
            "user": {
                "email": "your@email",
                "password": "password"
            },
            "platform": "LgEnerVu"
        }
    ]
```

### Optional Parameters
Below are the optional parameters with their default settings if not specified. 
```json
        {
            "updateMotionSensor": true,
            "batterySoc": true,
            "pvPower": true,
            "loadPower": true,
            "batteryPower": true,
            "gridPower": true,
            "refreshTimeInMinutes": 1,
            "latestDataForPower": true,
            "language": "de-DE",
            "userAgent": 
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "sessionData": {
                "Cookie": "JSESSIONID=toBeFilled; lang=de; country=DE; ctCode=DE; AWSELB=toBeFilled; AWSELBCORS=toBeFilled; enervuCookieCompliance=on",
                "system_id": "toBeFilled",
                "ess_id": "toBeFilled"
            },
        }
```
| Option                       | Default                      | Explanation|
| ---------------------------- | ---------------------------- |  --------------------------------------------------------|
| `updateMotionSensor`         | true                         | Motion sensor that is triggered whenever new data is available, based on the refresh time settings and your ESS updating the cloud. Turn off to not create a motion sensor, e.g. when using the Eve App for automation|
| `batterySoc`                 | true                         | Current battery level in percent, displayed via the lux reading of a light sensor for automation & battery status of all accessories. Disable to not create the light sensor and not show battery level.|
| `pvPower`                    | true                         | The power produced by the PV system in Watts, displayed via the lux reading of a light sensor. Disable to not create the light sensor.|
| `loadPower`                  | true                         | The power consumed by the load in Watts, displayed via the lux reading of a light sensor. Disable to not create the light sensor.|
| `batteryPower`               | true                         | The charging or discharging power of your battery in Watts, displayed via the lux reading of a light sensor & two switches turning on when charging/ discharging. Disable to not create the accessories.|
| `gridPower`                  | true                         | The power exchange with the grid in Watts, displayed via the lux reading of a light sensor & two switches turning on when buying/selling electricity. Disable to not create the accessories.|
| `refreshTimeInMinutes`       | 1   [Range: 1-5]             | Time in Minutes between updates. Restricted by ESS data updates (once per Minute) and server timeout (≈ 5 Minutes)|
| `latestDataForPower`       | true             | The ESS sends 6 blocks of data, each with the average values for 10 seconds of the last minute. By default, the plugin picks the latest data, i.e. the average value from hh:mm:50 to hh:mm:60. If you prefer the average value of the last minute, set this to false. |
| `language`                   |"de-De" (=German-Germany)     | Sets the language for the site. Match this to your usual settings to have a consistent login history. Check [here](https://www.fincher.org/Utilities/CountryLanguageList.shtml) for a list of country codes. |
| `userAgent`                  | "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" (=Safari on MacOS)| Your default user agent (browser signature) when logging into EnerVu. Match this to your usual settings to have a consistent login history.|
| `sessionData`                |     undefined                | See below for more details. When sessionData is provided, all of Cookie, system_id and ess_id must be filled to create a valid config|

When disabling accessories after they have been created before, you might need to delete the LG EnerVu device from Homebridge cache inside settings for them to immediately disappear.

#### Session data

This data automatically created on successful login to avoid needing to log in again after server restarts. On first launch, the plugin will use the  session data to latch onto the session and ignore the provided username and password. This can also be used in case you don't want to supply your email and password but only a temporary cookie. First log into LG EnerVu and open developer tools. Both systemId and essId can be found by searching for them in the response of "main.do>XHRs>dashboard.do". Replace the fields inside Cookie with the values from your session. The existing session will be refreshed by the plugin indefinitely. Note that a session is closed by the server on inactivity, e.g. when a network error occurs, and these steps need to be repeated if no valid credentials are provided. To pass the config check, simply fill username and password with non-empty strings, e.g. "a_at_b.com".

## Getting started & creating Automations

After adding the bridge, you will only see one tile. Opening it and accessing its settings, you can find all configured devices. Tapping them and deleting the default name reveals their actual function & you can name them accordingly.\
Automations can be created using shortcuts inside your home app or with the help of the Eve App. If you prefer to use shortcuts inside the home app, create an automation triggered by the motion sensor and then scroll to the bottom to find "Convert to shortcut". Here you can create conditions against the light sensors, specifying exact trigger values.
You can find a tutorial on how to use the Eve App for automation based on light sensors [here](https://github.com/AllMightySauron/homebride-solaxcloud-api). You can disable the update switch when going this route.

