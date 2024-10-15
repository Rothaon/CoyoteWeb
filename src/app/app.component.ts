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
        console.log(`Service: ${service.uuid}`);
        const characteristics = await service.getCharacteristics();

        for (const characteristic of characteristics)
        {
          console.log(`Characteristic: ${characteristic.uuid}`);
          const value = await characteristic.readValue();
          console.log(`Value: ${this.bufferToHex(value.buffer)}`);
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
