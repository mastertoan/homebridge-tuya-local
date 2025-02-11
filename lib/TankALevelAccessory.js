const BaseAccessory = require('./BaseAccessory');

class TankALevelAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.SENSOR;
    }

    constructor(...props) {
        super(...props);
        
        // Định nghĩa các mã DP (Data Point)
        this.dpLiquidState = '1';       // Trạng thái mức nước
        this.dpLiquidDepth = '2';       // Độ sâu hiện tại
        this.dpMaxSet = '3';            // Cài đặt mức cao nhất
        this.dpMiniSet = '4';           // Cài đặt mức thấp nhất
        this.dpInstallHeight = '5';      // Chiều cao lắp đặt
        this.dpLiquidDepthMax = '6';     // Độ sâu tối đa
        this.dpLiquidLevelPercent = '7'; // Phần trăm mức nước
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;
        this.accessory.addService(Service.HumiditySensor, this.device.context.name);
        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const service = this.accessory.getService(Service.HumiditySensor);
        this._checkServiceName(service, this.device.context.name);

        // Đăng ký đặc tính mức nước (%)
        const characteristicCurrentLevel = service.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .updateValue(this._getLiquidLevel(dps[this.dpLiquidLevelPercent]))
            .on('get', this.getLiquidLevel.bind(this));

        // Đăng ký đặc tính trạng thái rò rỉ
        const characteristicLeakDetected = service.getCharacteristic(Characteristic.LeakDetected)
            .updateValue(this._getLeakStatus(dps[this.dpLiquidState]))
            .on('get', this.getLeakStatus.bind(this));

        // Theo dõi thay đổi từ thiết bị
        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpLiquidLevelPercent)) {
                const newLevel = this._getLiquidLevel(changes[this.dpLiquidLevelPercent]);
                if (characteristicCurrentLevel.value !== newLevel) {
                    characteristicCurrentLevel.updateValue(newLevel);
                }
            }

            if (changes.hasOwnProperty(this.dpLiquidState)) {
                const newLeakStatus = this._getLeakStatus(changes[this.dpLiquidState]);
                if (characteristicLeakDetected.value !== newLeakStatus) {
                    characteristicLeakDetected.updateValue(newLeakStatus);
                }
            }

            this.log.debug('Tank state changed:', state);
        });
    }

    // Lấy mức nước hiện tại
    getLiquidLevel(callback) {
        this.getState(this.dpLiquidLevelPercent, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getLiquidLevel(dp));
        });
    }

    _getLiquidLevel(value) {
        return value || 0;
    }

    // Lấy trạng thái rò rỉ
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
                return Characteristic.LeakDetected.LEAK_DETECTED;
            case 'lower_alarm':
                return Characteristic.LeakDetected.LEAK_DETECTED;
            case 'normal':
            default:
                return Characteristic.LeakDetected.LEAK_NOT_DETECTED;
        }
    }
}

module.exports = TankALevelAccessory;
