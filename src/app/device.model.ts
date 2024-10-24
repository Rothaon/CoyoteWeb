import { EventEmitter, Output, Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class DeviceModel
{
  @Output() waveformARead: EventEmitter<[number, number, number]> = new EventEmitter();
  @Output() waveformBRead: EventEmitter<[number, number, number]> = new EventEmitter();
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

  waveABuffer: ArrayBuffer = new ArrayBuffer(3);
  waveBBuffer: ArrayBuffer = new ArrayBuffer(3);
  isSendingWaveform: boolean = false;

  constructor()
  {
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
        this.subscribeBatteryLevel();
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
        this.subscribeABPowerChannel();
      }
      else if( characteristic.uuid == "955a1505-0fe2-f5aa-a094-84b8d4f3e8ad" )
      {
        // Waveform A
        this.waveformACharacteristic = characteristic;
        this.readWaveformA();
      }
      else if( characteristic.uuid == "955a1506-0fe2-f5aa-a094-84b8d4f3e8ad" )
      {
        // Waveform B
        this.waveformBCharacteristic = characteristic;
        this.readWaveformB();
      }
      else if( characteristic.uuid == "955a1507-0fe2-f5aa-a094-84b8d4f3e8ad" )
      {
        // Config
        this.configCharacteristic = characteristic;
        this.getConfig();
      }
    }
  }
  
  // -- READ/WRITE CHARACTERISTICS --

  async updateBatteryLevel()
  {
    console.log("Requesting Battery Level");
    this.batteryLevelCharacteristic.readValue().then((value:any) => {
      console.log("Battery Level: " + value.getUint8(0));
      this.batteryLevel = value.getUint8(0);
    });
  }

  async subscribeBatteryLevel()
  {
    this.batteryLevelCharacteristic.startNotifications().then(() => {
      this.batteryLevelCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        this.batteryLevel = value.getUint8(0);
        console.log("Notified Battery Level: " + this.batteryLevel);
      });
    });
  }

  async readABPowerChannel()
  {
    this.channelABPowerCharacteristic.readValue().then((value:any) => {
      const [powerA, powerB] = this.parsePower(new DataView(value.buffer), /*no flip*/ true);

      console.log("Channel A: " + powerA + " Channel B: " + powerB);
      
      this.channelA = powerA;
      this.channelB = powerB;
    });
  }

  async subscribeABPowerChannel()
  {
    console.log("Requesting Channel A and B Power");
    this.channelABPowerCharacteristic.startNotifications().then(() => {
      this.channelABPowerCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const [powerA, powerB] = this.parsePower(new DataView(value.buffer));
    
        console.log("Channel A: " + powerA + " Channel B: " + powerB);
    
        this.channelA = powerA;
        this.channelB = powerB;
      });
    });
  }

  async writeChannelAStrength(channelA: number)
  {
    let buffer = this.encodePower(channelA, this.channelB ?? 0);
    await this.channelABPowerCharacteristic.writeValue(buffer);
  }

  async writeChannelBStrength(channelB: number)
  {
    let buffer = this.encodePower(this.channelA ?? 0, channelB);
    await this.channelABPowerCharacteristic.writeValue(buffer);
  }

  startSendingWaveform(id: string)
  {
    this.isSendingWaveform = true;
    // every 0.1 call sendNewWaveform
    let count = 0;
    const intervalId = setInterval(async () => {
      if (count >= 50)
      {
        clearInterval(intervalId);
        this.isSendingWaveform = false;
        return;
      }
      if (id == "A")
        await this.waveformBCharacteristic.writeValue(this.waveABuffer);
      else
        await this.waveformACharacteristic.writeValue(this.waveBBuffer);

      ++count;
    }, 100);
  }

  async readWaveformA()
  {
    this.waveformACharacteristic.readValue().then((value:any) => {
      const [ax, ay, az] = this.parseWaveform(new DataView(value.buffer));
      console.log("Waveform A: " + ax + " " + ay + " " + az);
      this.writeWaveformA(ax, ay, az);
      this.waveformARead.emit([ax, ay, az]);
    });
  }

  async readWaveformB()
  {
    this.waveformBCharacteristic.readValue().then((value:any) => {
      const [bx, by, bz] = this.parseWaveform(new DataView(value.buffer));
      console.log("Waveform B: " + bx + " " + by + " " + bz);
      this.writeWaveformB(bx, by, bz);
      this.waveformBRead.emit([bx, by, bz]);
    });
  } 

  async writeWaveformA(ax: number, ay: number, az: number)
  {
    this.waveABuffer = this.encodeWaveform(ax, ay, az);
  }

  async writeWaveformB(bx: number, by: number, bz: number)
  {
    this.waveBBuffer = this.encodeWaveform(bx, by, bz);
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
  
  // -- HELPERS
  parseWaveform(dataView: DataView): [number, number, number]
  {
    this.flipFirstAndThirdByte(dataView.buffer);
    // flipFirstAndThirdByte(zero(4) ~ uint(5).as("az") ~ uint(10).as("ay") ~ uint(5).as("ax"))
    // 0000zzzz | zyyyyyyy | yyyxxxxx
    const az = (dataView.getUint16(0) & 0b00001111_10000000) >>> 7;
    const ay = ((dataView.getUint16(0) & 0b00000000_01111111) << 3) | ((dataView.getUint8(2) & 0b11100000) >>> 5);
    const ax = (dataView.getUint8(2) & 0b00011111);
    return [ax, ay, az];
  }
  
  encodeWaveform(ax: number, ay: number, az: number): ArrayBuffer {
    const buffer = new ArrayBuffer(3);
    // flipFirstAndThirdByte(zero(4) ~ uint(5).as("az") ~ uint(10).as("ay") ~ uint(5).as("ax"))
    // 0000zzzz | zyyyyyyy | yyyxxxxx
    const view = new DataView(buffer);
    view.setUint8(0, ((az & 0b00011110) >>> 1));
    view.setUint16(1, ((az & 0b00000001) << 15) | ((ay & 0b00000011_11111111) << 5) | (ax & 0b00011111));

    this.flipFirstAndThirdByte(buffer);
    return buffer;
  }

  // New method to parse power levels
  parsePower(dataView: DataView, skipFlip:boolean = false): [number, number]
  {
    if(!skipFlip)
    {
      this.flipFirstAndThirdByte(dataView.buffer);
    }

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