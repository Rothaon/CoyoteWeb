export class DeviceModel
{
  // Max Poer 2000
  // Step 7
  // Known upon construction.
  name: string = '';
  id: string = '';

  // Async properties.
  batteryLevel: number | null = null;
  channelA: number | null = null;
  channelB: number | null = null;
  maxPower: number | null = null;
  powerStep: number | null = null;
  
  gattServer: any = null;
  
  batteryService: any = null;
  batteryLevelCharacteristic: any = null;
  
  signalService: any = null;
  channelABPowerCharacteristic: any = null;
  waveformACharacteristic: any = null;
  waveformBCharacteristic: any = null;
  configCharacteristic: any = null;

  readonly BATT_SERVICE_UUID: string = "955a180a-0fe2-f5aa-a094-84b8d4f3e8ad";
  readonly SIGNAL_SERVICE_UUID: string = "955a180b-0fe2-f5aa-a094-84b8d4f3e8ad";

  readonly BATT_LEVEL_CHAR_UUID: string = "955a1500-0fe2-f5aa-a094-84b8d4f3e8ad";
  readonly AB_CHANNEL_POWER_CHAR_UUID: string = "955a1504-0fe2-f5aa-a094-84b8d4f3e8ad";
  readonly WAVERFORM_A_CHAR_UUID: string = "955a1505-0fe2-f5aa-a094-84b8d4f3e8ad";
  readonly WAVERFORM_B_CHAR_UUID: string = "955a1506-0fe2-f5aa-a094-84b8d4f3e8ad";

  readonly CONFIG_CHAR_UUID: string = "955a1507-0fe2-f5aa-a094-84b8d4f3e8ad"

  isSendingWaveform: boolean = false;

  constructor()
  {
    // console.log("Pre A");
    // this.sendNewWaveform(31,0,0)
    // console.log("Pre B");
    // this.sendNewWaveform(0,1023,0);
    // console.log("Pre C");
    // this.sendNewWaveform(0,0,31);
    // console.log("Post C");
    // this.sendNewWaveform(1,9,20);
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
        this.readABPowerChannel();
      }
      else if( characteristic.uuid == "955a1505-0fe2-f5aa-a094-84b8d4f3e8ad" )
      {
        // Waveform A
        this.waveformACharacteristic = characteristic;
      }
      else if( characteristic.uuid == "955a1506-0fe2-f5aa-a094-84b8d4f3e8ad" )
      {
        // Waveform B
        this.waveformBCharacteristic = characteristic;
      }
      else if( characteristic.uuid == "955a1507-0fe2-f5aa-a094-84b8d4f3e8ad" )
      {
        // Config
        this.configCharacteristic = characteristic;
        this.getConfig();
      }
    }
  }

  async readABPowerChannel()
  {
    console.log("Requesting Channel A and B Power");
    this.channelABPowerCharacteristic.readValue().then((value:any) => {
      const [powerA, powerB] = this.parsePower(new DataView(value.buffer));

      console.log("KChannel A: " + powerA);
      console.log("KChannel B: " + powerB);

      this.channelA = powerA;
      this.channelB = powerB;
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

  // It looks like A and B channels are switched.
  async writeABPowerChannel(channelA: number | null, channelB: number | null)
  {
    console.log("Writing Channel A and B Power" + channelA + " " + channelB);
    if (channelB !== null && channelA !== null)
    {
      /**
       * notify/write: 3 bytes: zero(2) ~ uint(11).as("powerLevelB") ~uint(11).as("powerLevelA")
       * 0 0 b b b b b b  | b b b b b a a a | a a a a a a a a
       * Power levels must likely be a multiple of "powerStep" and between 0 and "maxPower" (as obtained through config attribute.)
       */
      const buffer = new ArrayBuffer(3);
      const dataView = new DataView(buffer);

      // CHANNEL B - Top 6 in first byte right, bottom 5 in second byte left.
      const top6BBits = (channelB & 0x7E0) >>> 5;
      dataView.setUint8(0, top6BBits);
      const low5Bits = (channelB & 0x1F) << 3;
      dataView.setUint8(1, low5Bits);

      // CHANNEL A - Top 3 in second byte right, bottom 8 in third byte.
      const top3Bits = (channelA & 0x700) >>> 8;
      // Dont overwrite channel A bits
      dataView.setUint8(1, dataView.getUint8(1) | top3Bits);

      // Last byte are 8 lower of channel b
      dataView.setUint8(2, (channelA & 0xFF));

      await this.channelABPowerCharacteristic.writeValue(buffer);
      // console.log('Buffer written:', new Uint8Array(buffer));
    }
  }

  async updateChannelAStrength(channelA: number)
  {
    console.log("Updating Channel A Strength A:" + channelA + " B: " + this.channelB);

    // Get buffer
    let buffer = this.encodePower(channelA, this.channelB ?? 0);

    await this.channelABPowerCharacteristic.writeValue(buffer);

    this.readABPowerChannel();
  }

  async updateChannelBStrength(channelB: number)
  {
    console.log("Updating Channel B Strength A:" + this.channelA + "B: " + channelB);
    
    // Get buffer
    let buffer = this.encodePower(this.channelA ?? 0, channelB);

    await this.channelABPowerCharacteristic.writeValue(buffer);
    
    this.readABPowerChannel();
  }

  startSendingWaveform()
  {
    this.isSendingWaveform = true;
    // every 0.1 call sendNewWaveform
    let count = 0;
    const intervalId = setInterval(() => {
      if (count >= 5)
      {
        clearInterval(intervalId);
        this.isSendingWaveform = false;
        return;
      }
      this.sendNewWaveform(5, 95, 20);
      ++count;
    }, 100);
  }

  // Waveform control module (XYZ)
  // X: 5 bits of data from 0 to 4 in PWM_A34 or PWM_B34 [0-31]
  // Y: 10 bits of data from 5 to 14 in PWM_A34 or PWM_B34 [0-1023]
  // Z: 5 bits of data from 15 to 19 in PWM_A34 or PWM_B34 [0-31]
  async sendNewWaveform(x: number, y: number, z: number)
  {
    //23-20bit (reserved) 19-15bit (Az) 14-5bit (Ay) 4-0bit (Ax)
    console.log("Sending New Waveform " + x + " " + y + " " + z);
    const buffer = new ArrayBuffer(3);
    const dataView = new DataView(buffer);

    // 0000 ZZZZ | ZYYY YYYY| YYYX XXXX
    // X

    dataView.setUint8(2, x);

    // Y
    const lowY3Bits = (y & 0x7) << 5;
    dataView.setUint8(2, dataView.getUint8(2) | lowY3Bits);

    const highY5Bits = (y & 0x3E0) >>> 5;
    dataView.setUint8(1, highY5Bits);


    const high3YBits = (y & 0x380) >> 7;
    dataView.setUint8(0, dataView.getUint8(0) | high3YBits);
    const low7YBits = (y & 0x7F ) << 1;
    dataView.setUint8(1, low7YBits);

    // Z
    const low1ZBits = (z & 0x1) << 7;
    dataView.setUint8(1, dataView.getUint8(1) | low1ZBits);

    const high4ZBits = (z & 0x1E) >>> 1;

    dataView.setUint8(0, high4ZBits);

    await this.waveformBCharacteristic.writeValue(buffer);
    console.log('Buffer written:', new Uint8Array(buffer));
  }

  async getConfig()
  {
    console.log('Reading Config Characteristic...');

    // Assuming `config` is a BluetoothRemoteGATTCharacteristic
    const configValue = await this.configCharacteristic.readValue();

    // Flip the first and third bytes
    this.flipFirstAndThirdByte(configValue.buffer);

    // Read the values
    const maxPower = configValue.getUint16(0);
    const powerStep = configValue.getUint8(2);

    this.maxPower = maxPower;
    this.powerStep = powerStep;

    console.log('Max Power:', maxPower);
    console.log('Power Step:', powerStep);
  }

  // New method to parse power levels
  parsePower(dataView: DataView): [number, number]
  {
    this.flipFirstAndThirdByte(dataView.buffer);

    // notify/write: 3 bytes: flipFirstAndThirdByte(zero(2) ~ uint(11).as("powerLevelB") ~uint(11).as("powerLevelA")
    const powerA = dataView.getUint16(0) >> 3; // push the remainder of B out of the first 2 bytes
    const powerB = dataView.getUint16(1) & 0b0000011111111111; // push the remainder A out of the last 2 bytes

    return [powerA, powerB];
  }

  encodePower(powerA: number, powerB: number): ArrayBuffer {
    /**
     * notify/write: 3 bytes: zero(2) ~ uint(11).as("powerLevelB") ~uint(11).as("powerLevelA")
     * 0 0 a a a a a a | a a a a a b b b | b b b b b b b b
     * Power levels must likely be a multiple of "powerStep" and between 0 and "maxPower" (as obtained through config attribute.)
     */

    const buffer = new ArrayBuffer(3);
    const view = new DataView(buffer);
    view.setUint8(0, (powerA >>> 5) & 0b00111111);
    view.setUint8(1, ((powerA & 0b00011111) << 3) | ((powerB & 0b11111111111) >>> 8));
    view.setUint8(2, powerB & 0b11111111);

    this.flipFirstAndThirdByte(buffer);
    return buffer;
}

  // Helper function to flip the first and third bytes
  flipFirstAndThirdByte(buffer: ArrayBuffer)
  {
    const dataView = new DataView(buffer);
    const firstByte = dataView.getUint8(0);
    const thirdByte = dataView.getUint8(2);

    dataView.setUint8(0, thirdByte);
    dataView.setUint8(2, firstByte);
  }
}