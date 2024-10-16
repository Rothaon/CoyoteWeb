/// <reference types="web-bluetooth" />

import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'BTest';

  ngOnInit() {
    // Initialization logic if any
  }

  // Function to print available, unpaired BTLE devices
  async printUnpairedBTLEDevices() {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'D-LAB' }
        ],
        optionalServices: [
          '955a180a-0fe2-f5aa-a094-84b8d4f3e8ad', // Battery level.
          '955a180b-0fe2-f5aa-a094-84b8d4f3e8ad'] // Pulse writers.
        // acceptAllDevices: true,
      });
      console.log('Selected device:', device.name);
      console.log('Selected Device ID:', device.id);

      if (!device.gatt)
        {
        throw new Error('GATT server not available on the device');
      }

      const gattServer = await device.gatt.connect();
      console.log('Connected to GATT server:', gattServer.connected);
      const services = await gattServer.getPrimaryServices();
      console.log(' Post Services:');
      for (const service of services)
      {
        console.log("----------------------------------------");
        console.log(`Service: ${service.uuid}`);
        const characteristics = await service.getCharacteristics();

        for (const characteristic of characteristics)
        {
          let uuid = characteristic.uuid;
          // console.log(`Characteristic: ${characteristic.uuid}`);
          const value = await characteristic.readValue();
          // Only for the A/Battery Level service
          if( uuid == "955a1500-0fe2-f5aa-a094-84b8d4f3e8ad" )
          {
            // console.log("Byte Length of:", value.byteLength + " To int (dec): " + value.getUint8(0));
            console.log("Battery Level: " + value.getUint8(0));
            // Print each bit of value
              // Convert the value to an 8-bit binary string
            const binaryString = (value.getInt8(0) & 0xFF).toString(2).padStart(8, '0');

            // Print each bit
            for (let i = 0; i < binaryString.length; i++)
            {
              // console.log(`Bit ${i}: ${binaryString[i]}`);
            }
          }
          // Power module(S)
          // 23-22bit (reserved) 21-11bit (actual strength of channel B) 10-0bit (actual strength of channel A)
          else if( uuid == "955a1504-0fe2-f5aa-a094-84b8d4f3e8ad" )
          {
            // 23-22bit (reserved) 21-11bit (actual strength of channel B) 10-0bit (actual strength of channel A)
            console.log("Byte Length of:", value.byteLength );// + " To int (dec): " + value.getUint32(0));
            const dataView = new DataView(value.buffer);
            const rawValue = (dataView.getUint8(0) << 16) | (dataView.getUint8(1) << 8) | dataView.getUint8(2);

            const channelA = rawValue & 0x7FF; // Extract lower 11 bits
            const channelB = (rawValue >> 11) & 0x7FF; // Extract next 11 bits

            console.log(`Channel A: ${channelA}`);
            console.log(`Channel B: ${channelB}`);
          }
          else
          {
            // console.log(`Value (hex): ${this.bufferToHex(value.buffer)}`);
          }
        }
      }
    }
    catch (error)
    {
      console.error('Error scanning for BTLE devices:', error);
    }
  }

  // Helper function to convert buffer to hex string
  bufferToHex(buffer: ArrayBuffer): string {
    return Array.prototype.map.call(new Uint8Array(buffer), (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
  }
}
