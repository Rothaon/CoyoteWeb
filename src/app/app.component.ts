/// <reference types="web-bluetooth" />

import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DeviceModel } from './device.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  haveDevice: boolean = false;
  pairedDevice: any;

  deviceData: DeviceModel = new DeviceModel();


  title = 'BTest';

  ngOnInit() {
    // Initialization logic if any
  }

  // Function to print available, unpaired BTLE devices
  async printUnpairedBTLEDevices()
  {
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

      this.fillDeviceModel(device, gattServer);
  }

  // Helper function to convert buffer to hex string
  bufferToHex(buffer: ArrayBuffer): string {
    return Array.prototype.map.call(new Uint8Array(buffer), (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
  }

  // Function to fill device model
  fillDeviceModel(device: any, gattServer: any)
  {
    this.haveDevice = true;
    this.deviceData.name = device.name;
    this.deviceData.id = device.id;
    this.deviceData.batteryLevel = device.batteryLevel;
    this.deviceData.gattServer = gattServer;
    this.deviceData.getServices();
  }
}
