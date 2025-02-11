const BaseAccessory = require('./BaseAccessory');

class RFSwitchAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.SWITCH;
    }

    constructor(...props) {
        super(...props);

        // Định nghĩa các mã DP theo đúng API của thiết bị
        this.dpMode = 'light_mode';      // none/relay/pos
        this.dpSwitch1 = 'switch_1';     // Công tắc 1
        this.dpSwitch2 = 'switch_2';     // Công tắc 2  
        this.dpSwitch3 = 'switch_3';     // Công tắc 3
        this.dpSwitch4 = 'switch_4';     // Công tắc 4
        this.dpInching = 'switch_inching'; // Cấu hình thời gian

        this.log.info('Initializing RF Switch:', this.device.context.name);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        // Tạo 4 switch service thay vì outlet
        for (let i = 1; i <= 4; i++) {
            const existingService = this.accessory.getService(`switch${i}`);
            if (!existingService) {
                this.log.debug(`Adding switch service ${i}`);
                this.accessory.addService(Service.Switch, `Switch ${i}`, `switch${i}`);
            }
        }

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        
        this.log.info('Registering characteristics with DPS:', dps);
        
        // Xử lý cho 4 công tắc
        for (let i = 1; i <= 4; i++) {
            const service = this.accessory.getService(`switch${i}`);
            if (!service) {
                this.log.error(`Service not found for switch ${i}`);
                continue;
            }

            const dpKey = `switch_${i}`;
            
            this.log.debug(`Setting up switch ${i} with DP key:`, dpKey);

            service.getCharacteristic(Characteristic.On)
                .on('get', callback => {
                    this.log.debug(`-> Get ${dpKey}`);
                    this.getState(dpKey, (err, dp) => {
                        if (err) {
                            this.log.error(`Error getting state for ${dpKey}:`, err);
                            callback(err);
                        } else {
                            const value = this._getSwitch(dp);
                            this.log.debug(`<- ${dpKey} is ${value}`);
                            callback(null, value);
                        }
                    });
                })
                .on('set', (value, callback) => {
                    this.log.debug(`-> Set ${dpKey} to ${value}`);
                    this.setState(dpKey, value, err => {
                        if (err) {
                            this.log.error(`Error setting state for ${dpKey}:`, err);
                            callback(err);
                        } else {
                            this.log.debug(`<- ${dpKey} set to ${value}`);
                            callback();
                        }
                    });
                });
        }

        // Theo dõi thay đổi từ thiết bị
        this.device.on('change', (changes, state) => {
            this.log.info('Device state changed:', changes);
            
            for (let i = 1; i <= 4; i++) {
                const dpKey = `switch_${i}`;
                if (changes.hasOwnProperty(dpKey)) {
                    const service = this.accessory.getService(`switch${i}`);
                    if (!service) continue;

                    const newValue = this._getSwitch(changes[dpKey]);
                    this.log.debug(`Updating ${dpKey} to ${newValue}`);
                    
                    service.getCharacteristic(Characteristic.On)
                        .updateValue(newValue);
                }
            }
        });

        // Xử lý sự kiện kết nối/ngắt kết nối
        this.device.on('connect', () => {
            this.log.debug(`[${this.device.context.name}] Connected to device`);
        });

        this.device.on('disconnect', () => {
            this.log.debug(`[${this.device.context.name}] Disconnected from device`);
        });

        this.device.on('error', err => {
            this.log.debug(`[${this.device.context.name}] Device error:`, err);
        });
    }

    _getSwitch(value) {
        if (value === undefined) {
            this.log.debug('Switch value is undefined, defaulting to false');
            return false;
        }
        return value === true || value === 1 || value === 'true';
    }
}

module.exports = RFSwitchAccessory; 