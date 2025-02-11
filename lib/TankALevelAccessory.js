const BaseAccessory = require('./BaseAccessory');

class TankALevelAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.SENSOR;
    }

    constructor(...props) {
        super(...props);
        
        // Định nghĩa các mã DP (Data Point) theo API thực tế
        this.dpLiquidState = '1';        // liquid_state: normal/upper_alarm/lower_alarm
        this.dpLiquidDepth = '2';        // liquid_depth: độ sâu hiện tại (mm)
        this.dpMaxSet = '7';             // max_set: ngưỡng cao (%)
        this.dpMiniSet = '8';            // mini_set: ngưỡng thấp (%)
        this.dpInstallHeight = '19';      // installation_height: chiều cao lắp đặt (mm)
        this.dpLiquidDepthMax = '21';     // liquid_depth_max: độ sâu tối đa (mm)
        this.dpLiquidLevelPercent = '22'; // liquid_level_percent: phần trăm mức nước (%)
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;
        
        // Đảm bảo chỉ tạo service nếu chưa tồn tại
        if (!this.accessory.getService(Service.LeakSensor)) {
            this.accessory.addService(Service.LeakSensor, this.device.context.name);
        }
        
        if (!this.accessory.getService(Service.HumiditySensor)) {
            this.accessory.addService(Service.HumiditySensor, this.device.context.name + " Level");
        }
        
        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        
        // Lấy service đã tồn tại
        const leakService = this.accessory.getService(Service.LeakSensor);
        if (leakService) {
            this._checkServiceName(leakService, this.device.context.name);
        }

        const levelService = this.accessory.getService(Service.HumiditySensor);
        if (levelService) {
            this._checkServiceName(levelService, this.device.context.name + " Level");
        }

        // Chỉ đăng ký characteristic nếu service tồn tại
        if (leakService) {
            const characteristicLeakDetected = leakService.getCharacteristic(Characteristic.LeakDetected)
                .updateValue(this._getLeakStatus(dps[this.dpLiquidState]))
                .on('get', this.getLeakStatus.bind(this));
        }

        if (levelService) {
            const characteristicCurrentLevel = levelService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .updateValue(this._getLiquidLevel(dps[this.dpLiquidLevelPercent]))
                .on('get', this.getLiquidLevel.bind(this));

            // Theo dõi thay đổi từ thiết bị
            this.device.on('change', (changes, state) => {
                if (changes.hasOwnProperty(this.dpLiquidState) && leakService) {
                    const newLeakStatus = this._getLeakStatus(changes[this.dpLiquidState]);
                    const characteristicLeakDetected = leakService.getCharacteristic(Characteristic.LeakDetected);
                    if (characteristicLeakDetected.value !== newLeakStatus) {
                        characteristicLeakDetected.updateValue(newLeakStatus);
                    }
                }

                if (changes.hasOwnProperty(this.dpLiquidLevelPercent)) {
                    const newLevel = this._getLiquidLevel(changes[this.dpLiquidLevelPercent]);
                    if (characteristicCurrentLevel.value !== newLevel) {
                        characteristicCurrentLevel.updateValue(newLevel);
                    }
                }
            });
        }
    }

    getLiquidLevel(callback) {
        this.getState(this.dpLiquidLevelPercent, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getLiquidLevel(dp));
        });
    }

    _getLiquidLevel(value) {
        return value || 0;
    }

    getLeakStatus(callback) {
        this.getState(this.dpLiquidState, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getLeakStatus(dp));
        });
    }

    _getLeakStatus(state) {
        const {Characteristic} = this.hap;
        switch(state) {
            case 'upper_alarm':
            case 'lower_alarm':
                return Characteristic.LeakDetected.LEAK_DETECTED;
            case 'normal':
            default:
                return Characteristic.LeakDetected.LEAK_NOT_DETECTED;
        }
    }
}

module.exports = TankALevelAccessory;
