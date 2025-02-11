const BaseAccessory = require('./BaseAccessory');

class RFSwitchAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.OUTLET;
    }

    constructor(...props) {
        super(...props);

        // Định nghĩa các mã DP (Data Point)
        this.dpMode = 'light_mode';      // none/relay/pos
        this.dpSwitch1 = 'switch_1';     // Công tắc 1
        this.dpSwitch2 = 'switch_2';     // Công tắc 2  
        this.dpSwitch3 = 'switch_3';     // Công tắc 3
        this.dpSwitch4 = 'switch_4';     // Công tắc 4
        this.dpInching = 'switch_inching'; // Cấu hình thời gian
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        // Tạo 4 outlet service cho 4 công tắc
        for (let i = 1; i <= 4; i++) {
            if (!this.accessory.getService(`switch${i}`)) {
                this.accessory.addService(Service.Outlet, `Switch ${i}`, `switch${i}`);
            }
        }

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        
        // Log trạng thái ban đầu
        this.log.debug('Initial DPS:', JSON.stringify(dps));
        
        // Xử lý cho 4 công tắc
        for (let i = 1; i <= 4; i++) {
            const service = this.accessory.getService(`switch${i}`);
            if (!service) continue;

            this._checkServiceName(service, `Switch ${i}`);

            const dpKey = `switch_${i}`;
            
            // Log giá trị của từng công tắc
            this.log.debug(`Switch ${i} state:`, dps[dpKey]);

            service.getCharacteristic(Characteristic.On)
                .updateValue(this._getSwitch(dps[dpKey]))
                .on('get', callback => {
                    this.getState(dpKey, (err, dp) => {
                        if (err) return callback(err);
                        callback(null, this._getSwitch(dp));
                    });
                })
                .on('set', (value, callback) => {
                    this.log.debug(`Setting ${dpKey} to`, value);
                    this.setState(dpKey, value, callback);
                });
        }

        // Theo dõi thay đổi từ thiết bị
        this.device.on('change', (changes, state) => {
            this.log.debug('Device state changed:', JSON.stringify(changes));
            
            for (let i = 1; i <= 4; i++) {
                const dpKey = `switch_${i}`;
                if (changes.hasOwnProperty(dpKey)) {
                    const service = this.accessory.getService(`switch${i}`);
                    if (!service) continue;

                    const newValue = this._getSwitch(changes[dpKey]);
                    this.log.debug(`Updating ${dpKey} to`, newValue);
                    
                    service.getCharacteristic(Characteristic.On)
                        .updateValue(newValue);
                }
            }
        });
    }

    _getSwitch(value, callback) {
        // Chuyển đổi giá trị từ thiết bị thành boolean
        const boolValue = (value === true || value === 1 || value === 'true' || value === 'on');
        if (callback) callback(null, boolValue);
        return boolValue;
    }
}

module.exports = RFSwitchAccessory; 