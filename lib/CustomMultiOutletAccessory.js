const BaseAccessory = require('./BaseAccessory');
const async = require('async');

class CustomMultiOutletAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.OUTLET;
    }

    constructor(...props) {
        super(...props);
        
        // Kiểm tra và log cấu hình
        if (this.device.context.debugLog) {
            this.log.debug('Device context:', this.device.context);
        }
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        this.outlets = this.device.context.outlets || [];
        
        // Tạo service cho mỗi outlet
        this.outlets.forEach((outlet, i) => {
            this.accessory.addService(Service.Outlet, outlet.name, `outlet${i}`);
        });

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        
        // Đăng ký đặc tính cho mỗi outlet
        this.outlets.forEach((outlet, i) => {
            const service = this.accessory.getService(`outlet${i}`);
            if (!service) return;

            service.getCharacteristic(Characteristic.On)
                .on('get', callback => {
                    if (this.device.context.debugLog) {
                        this.log.debug(`Get outlet ${i} state:`, dps[outlet.dp]);
                    }
                    callback(null, dps[outlet.dp]);
                })
                .on('set', (value, callback) => {
                    if (this.device.context.debugLog) {
                        this.log.debug(`Set outlet ${i} to:`, value);
                    }
                    this.setOutletState(outlet.dp, value, callback);
                });
        });

        this.device.on('change', (changes, state) => {
            if (this.device.context.debugLog) {
                this.log.debug('Device state changed:', state);
            }

            this.outlets.forEach((outlet, i) => {
                if (changes.hasOwnProperty(outlet.dp)) {
                    const service = this.accessory.getService(`outlet${i}`);
                    if (service) {
                        service.updateCharacteristic(Characteristic.On, changes[outlet.dp]);
                    }
                }
            });
        });
    }

    setOutletState(dp, value, callback) {
        if (this.device.context.debugLog) {
            this.log.debug('Setting state:', {dp, value});
        }
        return this.setState(dp, value, callback);
    }
}

module.exports = CustomMultiOutletAccessory;