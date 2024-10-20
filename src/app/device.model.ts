export class DeviceModel
{
  // Known upon construction.
  name: string = '';
  id: string = '';

  // Async properties.
  batteryLevel: number | null = null;
  channelA: number | null = null;
  channelB: number | null = null;
  
  gattServer: any;
  
  batteryService: any;
  batteryLevelCharacteristic: any;
  
  signalService: any;
  channelABPowerCharacteristic: any;

  readonly BATT_SERVICE_UUID: string = "955a180a-0fe2-f5aa-a094-84b8d4f3e8ad";
  readonly SIGNAL_SERVICE_UUID: string = "955a180b-0fe2-f5aa-a094-84b8d4f3e8ad";

  readonly BATT_LEVEL_CHAR_UUID: string = "955a1500-0fe2-f5aa-a094-84b8d4f3e8ad";
  readonly AB_CHANNEL_POWER_CHAR_UUID: string = "955a1504-0fe2-f5aa-a094-84b8d4f3e8ad";

  constructor() {
  }

  async getServices()
  {
    console.log("Requesting Services");
    const services = await this.gattServer.getPrimaryServices();
    for (const service of services)
    {
      if( service.uuid == this.BATT_SERVICE_UUID )
      {
        // battery
        this.batteryService = service;
        this.getBatteryLevelCharacteristic();
      }
      else if (service.uuid == this.SIGNAL_SERVICE_UUID)
      {
        // signal
        this.signalService = service;
        this.getSignalCharacteristics();
      }
    }
  }

  async getBatteryLevelCharacteristic()
  {
    console.log("Requesting Battery Level Characteristics");
    const characteristics = await this.batteryService.getCharacteristics();
    for (const characteristic of characteristics)
    {
      if( characteristic.uuid == this.BATT_LEVEL_CHAR_UUID )
      {
        this.batteryLevelCharacteristic = characteristic;
        this.updateBatteryLevel();
      }
    }
  }

  async getSignalCharacteristics()
  {
    console.log("Requesting Signal Characteristics");
    const characteristics = await this.signalService.getCharacteristics();
    for (const characteristic of characteristics)
    {
      if( characteristic.uuid == "955a1504-0fe2-f5aa-a094-84b8d4f3e8ad" )
      {
        this.channelABPowerCharacteristic = characteristic;
        this.updateABPowerChannel();
      }
    }
  }

  async updateABPowerChannel()
  {
    console.log("Requesting Channel A and B Power");
    this.channelABPowerCharacteristic.readValue().then((value:any) => {
      const dataView = new DataView(value.buffer);

      const rawValue = (dataView.getUint8(0) << 16) | (dataView.getUint8(1) << 8) | dataView.getUint8(2);

      const channelB = (rawValue >> 11) & 0x7FF; // Extract next 11 bits
      const channelA = rawValue & 0x7FF; // Extract lower 11 bits

      console.log(`Channel A: ${channelA}`);
      console.log(`Channel B: ${channelB}`);

      this.channelA = channelA;
      this.channelB = channelB;
    });
  }

  updateBatteryLevel()
  {
    console.log("Requesting Battery Level");
    this.batteryLevelCharacteristic.readValue().then((value:any) => {
      console.log("Battery Level: " + value.getUint8(0));
      this.batteryLevel = value.getUint8(0);
    });
  }
}