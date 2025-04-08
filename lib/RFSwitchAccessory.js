const BaseAccessory = require('./BaseAccessory');

class RFSwitchAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.SWITCH;
    }

    constructor(...props) {
        // Phải gọi super() đầu tiên
        super(...props);
    
        // Sau khi gọi super() mới có thể sử dụng this
        this._initializeAccessory();
    }
    
    _initializeAccessory() {
        // Khởi tạo các thuộc tính sau khi đã gọi super()
        const deviceType = this.device.context.deviceType || 4;
        this.numChannels = deviceType === 7 ? 7 : 
                          deviceType === 8 ? 8 : 4;
    
        // Khởi tạo dpSwitches
        this.dpSwitches = {};
        for (let i = 1; i <= this.numChannels; i++) {
            this.dpSwitches[i] = {
                code: `switch_${i}`,
                name: `Switch ${i}`
            };
        }
    
        // Định nghĩa các mã DP theo API
        this.dpCommands = {
            mode: 'light_mode',
            inching: 'switch_inching'
        };
    
        this.log.info(`Initializing RF Switch with ${this.numChannels} channels:`, this.device.context.name);
    }
    
    _registerPlatformAccessory() {
        // Đảm bảo đã khởi tạo các thuộc tính cần thiết
        if (!this.dpSwitches) {
            this._initializeAccessory();
        }
    
        const {Service} = this.hap;
        
        this.log.info('_registerPlatformAccessory:', {
            numChannels: this.numChannels,
            dpSwitches: this.dpSwitches,
            name: this.device.context.name
        });
    
        try {
            // Tạo service cho mỗi kênh
            for (let i = 1; i <= this.numChannels; i++) {
                const switchName = this.dpSwitches[i].name;
                const existingService = this.accessory.getService(switchName);
                
                if (!existingService) {
                    this.log.debug(`Adding switch service ${i}: ${switchName}`);
                    this.accessory.addService(Service.Switch, switchName, `switch${i}`);
                } else {
                    this.log.debug(`Service ${switchName} already exists`);
                }
            }
    
            // Gọi super._registerPlatformAccessory sau khi đã setup xong
            super._registerPlatformAccessory();
        } catch (err) {
            this.log.error(`Error in _registerPlatformAccessory: ${err.message}`);
            throw err;
        }
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;

        this.log.info('Initial device state:', dps);
        
        // Xử lý cho mỗi kênh
        for (let i = 1; i <= this.numChannels; i++) {
            const service = this.accessory.getService(this.dpSwitches[i].name);
            if (!service) {
                this.log.error(`Service not found for ${this.dpSwitches[i].name}`);
                continue;
            }

            const dpCode = this.dpSwitches[i].code;
            
            this.log.debug(`Setting up ${this.dpSwitches[i].name} with code:`, dpCode);

            service.getCharacteristic(Characteristic.On)
                .on('get', callback => {
                    this.log.debug(`-> Get ${dpCode}`);
                    this.getState(dpCode, (err, dp) => {
                        if (err) {
                            this.log.error(`Error getting state for ${dpCode}:`, err);
                            callback(err);
                        } else {
                            const value = this._getSwitch(dp);
                            this.log.debug(`<- ${dpCode} is ${value}`);
                            callback(null, value);
                        }
                    });
                })
                .on('set', (value, callback) => {
                    this.log.debug(`-> Set ${dpCode} to ${value}`);
                    
                    // Tạo và gửi command theo format API
                    const commands = [{
                        code: dpCode,
                        value: value
                    }];

                    // Gửi command qua API
                    this.sendCommands(commands)
                        .then(() => {
                            this.log.debug(`<- ${dpCode} command sent successfully`);
                            callback();
                        })
                        .catch(err => {
                            this.log.error(`Error sending command for ${dpCode}:`, err);
                            callback(err);
                        });
                });
        }

        // Theo dõi thay đổi từ thiết bị
        this.device.on('change', (changes, state) => {
            this.log.info('Device state changed:', changes);
            
            for (let i = 1; i <= this.numChannels; i++) {
                const dpCode = this.dpSwitches[i].code;
                if (changes.hasOwnProperty(dpCode)) {
                    const service = this.accessory.getService(this.dpSwitches[i].name);
                    if (!service) continue;

                    const newValue = this._getSwitch(changes[dpCode]);
                    this.log.debug(`Updating ${dpCode} to ${newValue}`);
                    
                    service.getCharacteristic(Characteristic.On)
                        .updateValue(newValue);
                }
            }
        });

        // Xử lý sự kiện kết nối
        this.device.on('connect', () => {
            this.log.info(`[${this.device.context.name}] Connected`);
        });

        this.device.on('disconnect', () => {
            this.log.warn(`[${this.device.context.name}] Disconnected`);
        });

        this.device.on('error', err => {
            this.log.error(`[${this.device.context.name}] Error:`, err);
        });
    }

    _getSwitch(value) {
        if (value === undefined) {
            this.log.debug('Switch value is undefined, defaulting to false');
            return false;
        }
        return Boolean(value);
    }

    // Thêm phương thức sendCommands vào TuyaAccessory
    sendCommands(commands) {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(commands)) {
                commands = [commands];
            }

            this.log.debug('Sending commands:', JSON.stringify(commands));

            // Gửi qua API
            this._send({
                cmd: 7,
                data: {
                    commands: commands
                }
            }, null, (err, data) => {
                if (err) {
                    this.log.error('Error sending commands:', err);
                    reject(err);
                } else {
                    this.log.debug('Commands sent successfully:', data);
                    resolve(data);
                }
            });
        });
    }
}

module.exports = RFSwitchAccessory; 