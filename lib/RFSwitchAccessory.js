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
            this.accessory.addService(Service.Outlet, `Switch ${i}`, `switch${i}`);
        }

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        
        // Xử lý cho 4 công tắc
        for (let i = 1; i <= 4; i++) {
            const service = this.accessory.getService(`switch${i}`);
            if (!service) continue;

            this._checkServiceName(service, `Switch ${i}`);

            service.getCharacteristic(Characteristic.On)
                .updateValue(this._getSwitch(dps[`switch_${i}`]))
                .on('get', callback => this._getSwitch(dps[`switch_${i}`], callback))
                .on('set', this._setSwitch.bind(this, `switch_${i}`));
        }

        // Theo dõi thay đổi từ thiết bị
        this.device.on('change', (changes, state) => {
            for (let i = 1; i <= 4; i++) {
                const dpSwitch = `switch_${i}`;
                if (changes.hasOwnProperty(dpSwitch)) {
                    const service = this.accessory.getService(`switch${i}`);
                    if (!service) continue;

                    service.getCharacteristic(Characteristic.On)
                        .updateValue(this._getSwitch(changes[dpSwitch]));
                }
            }
        });
    }

    _getSwitch(value, callback) {
        if (callback) callback(null, value);
        return value;
    }

    _setSwitch(dp, value, callback) {
        this.setState(dp, value, error => {
            if (error) return callback(error);
            callback();
        });
    }
}

module.exports = RFSwitchAccessory; 