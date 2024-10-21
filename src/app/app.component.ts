/// <reference types="web-bluetooth" />

import { Component, Input, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DeviceModel } from './device.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  haveDevice: boolean = false;
  pairedDevice: any;

  deviceData: DeviceModel = new DeviceModel();

  title = 'BTest';
  channelAInput: any;
  channelBInput: any;

  // Waveform data
  axInput: number = 0;
  ayInput: number = 0;
  azInput: number = 0;
  bxInput: number = 0;
  byInput: number = 0;
  bzInput: number = 0;

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
  
  sendAChannelStrength()
  {
    console.log("Sending A Channel Strength" + this.channelAInput);
    this.deviceData.writeChannelAStrength(this.channelAInput);
  }
  
  sendBChannelStrength()
  {
    console.log("Sending B Channel Strength" + this.channelBInput);
    this.deviceData.writeChannelBStrength(this.channelBInput);
  }

  sendWaveA()
  {
    console.log("Sending Wave A");
    this.deviceData.writeWaveformA(this.axInput, this.ayInput, this.azInput);
  }

  sendWaveB()
  {
    console.log("Sending Wave B");
    this.deviceData.writeWaveformB(this.bxInput, this.byInput, this.bzInput);
  }
  
  startSendingWaveform()
  {
    console.log("Starting to send waveform");
    this.deviceData.startSendingWaveform();
  }

  // -- Helpers

  // Helper function to convert buffer to hex string
  bufferToHex(buffer: ArrayBuffer): string {
    return Array.prototype.map.call(new Uint8Array(buffer), (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
  }
}
