const BaseAccessory = require('./BaseAccessory');

class RFSwitchAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.SWITCH;
    }

    constructor(...props) {
        super(...props);

        // Xác định loại thiết bị (7 hoặc 8 kênh)
        const deviceType = this.device.context.deviceType || 4;  // Mặc định 4 kênh
        this.numChannels = deviceType === 7 ? 7 : 
                          deviceType === 8 ? 8 : 4;

        this.log.info(`Initializing RF Switch with ${this.numChannels} channels:`, this.device.context.name);

        // Định nghĩa các mã DP theo đúng API của thiết bị
        this.dpMode = 'light_mode';      // none/relay/pos
        
        // Khởi tạo mảng các DP switch
        this.dpSwitches = {};
        for (let i = 1; i <= this.numChannels; i++) {
            this.dpSwitches[i] = `switch_${i}`;
        }
        
        this.dpInching = 'switch_inching'; // Cấu hình thời gian
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        // Tạo service cho mỗi kênh
        for (let i = 1; i <= this.numChannels; i++) {
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
        
        // Xử lý cho mỗi kênh
        for (let i = 1; i <= this.numChannels; i++) {
            const service = this.accessory.getService(`switch${i}`);
            if (!service) {
                this.log.error(`Service not found for switch ${i}`);
                continue;
            }

            const dpKey = this.dpSwitches[i];
            
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
            
            for (let i = 1; i <= this.numChannels; i++) {
                const dpKey = this.dpSwitches[i];
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