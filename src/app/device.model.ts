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

  async updateBatteryLevel()
  {
    console.log("Requesting Battery Level");
    this.batteryLevelCharacteristic.readValue().then((value:any) => {
      console.log("Battery Level: " + value.getUint8(0));
      this.batteryLevel = value.getUint8(0);
    });
  }

  async writeABPowerChannel(channelB: number | null, channelA: number | null)
  {
    console.log("Writing Channel A and B Power");
    if (channelB !== null && channelA !== null) {
      const buffer = new ArrayBuffer(3);
      const dataView = new DataView(buffer);

      // CHANNEL B
      const high6Bits = (channelB & 0x7E0) >> 5;
      dataView.setUint8(0, high6Bits);

      const low5Bits = (channelB & 0x1F) << 3;
      dataView.setUint8(1, low5Bits);

      // CHANNEL A
      // 123 4567 89AB
      // 111 0000 0000
      // 123 0000 0000
      const maskedBits = (channelA & 0x700) >> 8;
      // 000 0000 0123
      // Dont overwrite channel A bits
      dataView.setUint8(1, dataView.getUint8(1) | maskedBits);

      // Last byte are 8 lower of channel b
      dataView.setUint8(2, (channelA & 0xFF)); // Upper 3 bits of channel B
      // 45567 89AB

      await this.channelABPowerCharacteristic.writeValue(buffer);
      console.log('Buffer written:', new Uint8Array(buffer));
    }
  }

  async updateChannelAStrength(channelA: number)
  {
    console.log("Updating Channel A Strength" + channelA);
    await this.writeABPowerChannel(this.channelB, channelA);
    this.updateABPowerChannel();
  }

  async updateChannelBStrength(channelB: number)
  {
    console.log("Updating Channel B Strength" + channelB);
    await this.writeABPowerChannel( channelB, this.channelA);
    this.updateABPowerChannel();
  }
}