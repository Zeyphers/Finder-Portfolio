import React, { useEffect, useState, useRef } from 'react';
import { VolumeX } from 'lucide-react';
import { BootConfig } from '../types';

interface BootAnimationProps {
  config: BootConfig;
  onComplete: () => void;
}

const DEFAULT_BOOT_TEXT = `Darwin Kernel Version 18.7.0: Tue Aug 20 16:57:14 PDT 2019; root:xnu-4903.271.2~2/RELEASE_X86_64
vm_page_bootstrap: 2084799 free pages and 237361 wired pages
kext submap [0x6BE8E201, 0x6F85A61A), kernel text [0xD89654C1, 0x69516772)
standard timeslicing quantum is 10000 us
mig_table_max_displ = 64
TSC Deadline Timer supported and enabled
[ PCI configuration begin ]
AppleACPICPU: ProcessorId=0 LocalApicId=0 Enabled
AppleACPICPU: ProcessorId=1 LocalApicId=1 Enabled
AppleACPICPU: ProcessorId=2 LocalApicId=2 Enabled
AppleACPICPU: ProcessorId=3 LocalApicId=3 Enabled
AppleACPICPU: ProcessorId=4 LocalApicId=4 Enabled
AppleACPICPU: ProcessorId=5 LocalApicId=5 Enabled
AppleACPICPU: ProcessorId=6 LocalApicId=6 Enabled
AppleACPICPU: ProcessorId=7 LocalApicId=7 Enabled
ACPI: sleep states S3 S4 S5
PCI configuration changed (bridge=1 device=13 cardbus=0)
[ PCI configuration end, bridges 3 devices 27 ]
PCIE: Initialization complete
SMC::smcReadKeyAction ERROR: smcReadData8 failed for key LSOF = ffffff
SMC::smcReadKeyAction ERROR: smcReadData8 failed for key MSSD = fffffffb
IOBSD Root:: ISS: 1
NTFS driver 13.2.3 [Flags: R/W].
NTFS volume name macOS Base System, version 3.1.
apfs_module_start:1689: load: com.apple.filesystems.apfs
apfs: version 945.275.1
AppleACPIPlatform: version 17.2.4, address 0xF19E8282, size 147K
AppleEFINVRAM: version 16.6.4, address 0xC508BF21, size 278K
AppleSMC: version 16.6.2, address 0x044C0AAF, size 245K
  AppleSMC::init completed
AppleHDA: version 3.4.6, address 0x511858D6, size 277K
  AppleHDA::init completed
AppleUSBXHCI: version 13.2.9, address 0x5EF4E505, size 439K
  AppleUSBXHCI::init completed
ApplePS2Controller: version 10.2.4, address 0x1CD9E69A, size 35K
AppleIntelPCHSeriesAHCI: version 11.7.3, address 0xCB7E890D, size 420K
AppleThunderboltDPInAdapter: version 5.1.5, address 0x2AD4B2FA, size 340K
IOBluetoothHCIController: version 10.0.4, address 0x74BD7760, size 60K
AppleUSBHub: version 7.8.8, address 0x59E694F3, size 343K
AppleKeyStore: version 3.3.0, address 0xF06EC049, size 69K
  AppleKeyStore::init completed
IOAHCIFamily: version 16.6.8, address 0x178ECAD9, size 189K
  IOAHCIFamily::init completed
com.apple.driver.AppleHPET: version 17.2.4, address 0x1702B221, size 148K
  com.apple.driver.AppleHPET::init completed
com.apple.driver.AppleMCCS: version 19.3.8, address 0xD6CBADE6, size 130K
  com.apple.driver.AppleMCCS::init completed
com.apple.iokit.IOSurface: version 19.0.7, address 0x6CFB1305, size 22K
com.apple.driver.AppleACPIButtons: version 19.5.2, address 0xE3517C28, size 258K
  com.apple.driver.AppleACPIButtons::init completed
com.apple.iokit.IOPCIFamily: version 4.0.7, address 0xDEB6F209, size 393K
  com.apple.iokit.IOPCIFamily::init completed
com.apple.driver.AppleRTC: version 14.6.4, address 0xC8F14784, size 483K
  com.apple.driver.AppleRTC::init completed
com.apple.driver.X86PlatformPlugin: version 11.2.7, address 0x65A3B471, size 342K
com.apple.driver.AppleSMBIOS: version 5.9.3, address 0x2FAD6D3B, size 259K
  com.apple.driver.AppleSMBIOS: WARNING: deprecated API usage detected
com.apple.driver.AppleAPIC: version 7.5.3, address 0x96F00A9C, size 56K
com.apple.kext.triggers: version 6.2.3, address 0xA596C04B, size 430K
com.apple.driver.AppleGraphicsControl: version 1.5.0, address 0x006B1252, size 277K
  com.apple.driver.AppleGraphicsControl: WARNING: deprecated API usage detected
com.apple.iokit.IOAHCIBlockStorage: version 18.1.1, address 0xCE9466E8, size 467K
com.apple.driver.AppleIntelSlimHDA: version 5.6.3, address 0x91A9CE14, size 241K
  com.apple.driver.AppleIntelSlimHDA::init completed
com.apple.driver.AppleMuxControl: version 8.1.3, address 0x31E548B0, size 87K
  com.apple.driver.AppleMuxControl::init completed
com.apple.iokit.IOThunderboltFamily: version 8.1.8, address 0xBA2F662A, size 306K
com.apple.filesystems.apfs: version 5.7.2, address 0x1A6DB92B, size 207K
com.apple.driver.AppleFileSystemDriver: version 16.6.5, address 0xAEB1A7C9, size 475K
  com.apple.driver.AppleFileSystemDriver::init completed
com.apple.driver.DiskImages: version 11.6.9, address 0x6A1FB6BF, size 314K
com.apple.BootCache: version 5.1.2, address 0xF9765CF0, size 18K
com.apple.security.sandbox: version 19.0.9, address 0x39199332, size 349K
com.apple.driver.AppleEmbeddedAudio: version 12.2.4, address 0x816D5A7C, size 217K
com.apple.driver.AppleLPC: version 18.1.8, address 0x808F03C5, size 250K
  com.apple.driver.AppleLPC::init completed
com.apple.driver.AppleUpstreamUserClient: version 20.1.0, address 0xB098928C, size 212K
com.apple.AMDRadeonX4000: version 14.7.5, address 0x525DE0CA, size 420K
  com.apple.AMDRadeonX4000::init completed
com.apple.iokit.IONetworkingFamily: version 17.0.2, address 0x8E831826, size 356K
com.apple.driver.AppleIntelLPSSPI: version 6.8.0, address 0xAF1914FB, size 151K
com.apple.driver.IOSlaveProcessor: version 10.6.5, address 0xAF3F7B4F, size 383K
com.apple.driver.AppleCameraInterface: version 20.2.7, address 0x1986D93C, size 147K
com.apple.driver.AppleTopCaseHIDEventDriver: version 2.2.8, address 0x05562D14, size 119K
  com.apple.driver.AppleTopCaseHIDEventDriver::init completed
com.apple.driver.AppleT2: version 9.1.4, address 0xAAD315FF, size 61K
  com.apple.driver.AppleT2: WARNING: deprecated API usage detected
IOPlatformExpertDevice: wake reason: 0x00
hibernation image path: /var/vm/sleepimage
boot_args: 
disk0: APPLE HDD ST1000LM035    Media size: 1000.2 GB
disk0s1: EFI EFI 209.7 MB
disk0s2: Apple_APFS Container disk1 999.35 GB
apfs_vfsop_mount:2726: mounted volume: Macintosh HD
disk1: synthesized
disk1s1: APFS Volume Macintosh HD 11.25 GB
disk1s2: APFS Volume Preboot 21.3 MB
disk1s3: APFS Volume Recovery 512.8 MB
disk1s4: APFS Volume VM 2.1 GB
hfs: mounted Preboot on device disk1s2
hfs: mounted Recovery on device disk1s3
EFI: NVRAM last writer was nvramd
NVRAM:  boot-args =
NVRAM:  security-mode = none
NVRAM:  SystemAudioVolume = %10
[IOHID] [6520]: init
[IOHID] [9524]: start
[IOHID] [1886]: AppleTopCaseHIDEventDriver start
11:40:12.441 kernel: com.apple.iokit.IOThunderboltFamily::attach() probe failed, errno=1
11:40:12.728 kernel: com.apple.kext.triggers::attach() probe failed, errno=1
11:40:12.674 kernel: com.apple.driver.AppleIntelSlimHDA::attach() OK
11:40:12.551 kernel: com.apple.driver.AppleAPIC::attach() probe failed, errno=4
11:40:12.889 kernel: com.apple.driver.AppleTopCaseHIDEventDriver::attach() OK
11:40:12.440 kernel: AppleHDA::attach() probe failed, errno=4
11:40:12.973 kernel: com.apple.driver.IOSlaveProcessor::attach() OK
11:40:12.307 kernel: com.apple.AMDRadeonX4000::attach() probe failed, errno=3
11:40:12.911 kernel: com.apple.driver.AppleACPIButtons::attach() OK
11:40:12.469 kernel: AppleIntelPCHSeriesAHCI::attach() OK
11:40:12.423 kernel: com.apple.iokit.IOThunderboltFamily::attach() OK
11:40:12.920 kernel: com.apple.kext.triggers::attach() OK
11:40:12.713 kernel: AppleKeyStore::attach() probe failed, errno=1
11:40:12.858 kernel: AppleEFINVRAM::attach() probe failed, errno=2
11:40:12.211 kernel: com.apple.driver.AppleSMBIOS::attach() probe failed, errno=1
11:40:12.949 kernel: com.apple.driver.AppleEmbeddedAudio::attach() OK
11:40:12.129 kernel: AppleHDA::attach() OK
11:40:12.891 kernel: com.apple.driver.AppleLPC::attach() probe failed, errno=6
11:40:12.610 kernel: AppleACPIPlatform::attach() probe failed, errno=1
11:40:12.246 kernel: AppleIntelPCHSeriesAHCI::attach() OK
AppleThunderboltHAL::start - bringup succeeded
USBF:    7793.445  AppleUSBXHCI::CreateRootHubDevice - failed to set an address for the hub
USB2.0 Hub @ 480 Mb/s, 16.700 (0x8087:0x8001)
USB Audio Device @ 12 Mb/s, 8.177 (0x4867:0xFDD9)
AppleUSBHub::start - starting hub with 7 ports
Bluetooth: Version 7.0.2f4, 3 services, 27 matching drivers
Bluetooth: BroadcomBluetoothHostControllerUSBTransport: USB product name: BCM20702A0
Bluetooth: HCI init sequence
Bluetooth: Firmware loaded from /System/Library/Extensions/BrcmPatchRAM3.kext
CoreStorage: logical volume group B258A4F9-E9A5-BAC9-F0A6-B161631F2C70 online
CoreStorage: disk disk1s5 is now online
CoreStorage: LVG UUID: D0F6CCB7-F9B4-8E10-0C58-DAA5FDA25839
AppleFileSystemDriver: loaded
HFS+ journal replayed
HFS+ enabling journaling
HFS+ journal start transaction
11:40:12.777 [launchd] Service com.apple.cloudd bootstrapping
11:40:12.186 [launchd] Service com.apple.backupd-auto stopping
11:40:12.336 [launchd] Service com.apple.coreaudiod disabling
11:40:12.701 [launchd] Service com.apple.WindowServer bootstrapping
11:40:12.985 [launchd] Service com.apple.backupd-auto stopped
11:40:12.676 [launchd] Service com.apple.systemstatsd disabling
11:40:12.020 [launchd] Service com.apple.notifyd stopping
11:40:12.473 [launchd] Service com.apple.thermalmonitord disabling
11:40:12.996 [launchd] Service com.apple.bluetoothd stopping
11:40:12.315 [launchd] Service com.apple.mediaremoted disabling
11:40:12.622 [launchd] Service com.apple.notifyd disabling
11:40:12.955 [launchd] Service com.apple.airportd starting
11:40:12.869 [launchd] Service com.apple.audiomxd started
11:40:12.023 [launchd] Service com.apple.systemstatsd started
11:40:12.416 [launchd] Service com.apple.cfprefsd stopped
11:40:12.173 [launchd] Service com.apple.ctkd stopped
11:40:12.974 [launchd] Service com.apple.thermalmonitord stopped
11:40:12.426 [launchd] Service com.apple.kextd starting
11:40:12.187 [launchd] Service com.apple.bluetoothd stopped
11:40:12.018 [launchd] Service com.apple.bluetoothd disabling
11:40:12.556 [launchd] Service com.apple.symptomsd bootstrapping
11:40:12.480 [launchd] Service com.apple.powerd enabling
11:40:12.127 [launchd] Service com.apple.powerd stopped
11:40:12.664 [launchd] Service com.apple.systemstatsd started
11:40:12.077 [launchd] Service com.apple.trustd disabling
11:40:12.893 [launchd] Service com.apple.coreduetd enabling
11:40:12.321 [launchd] Service com.apple.audiomxd bootstrapping
11:40:12.333 [launchd] Service com.apple.mtmd started
11:40:12.188 [launchd] Service com.apple.coreaudiod enabling
11:40:12.801 [launchd] Service com.apple.diskarbitrationd started
11:40:12.727 [launchd] System bootstrap complete
opendirectoryd: [9100]: Membership processing enabled
opendirectoryd: [7691]: Configured node /Local/Default
opendirectoryd: [9202]: Starting cache builder thread
mDNSResponder: mDNSCore version mDNSResponder-866.60.2
mDNSResponder: local hostname: MacBook-Pro-35DD.local
mDNSResponder: DNS configuration (for scoped queries)
    nameserver[0] = 192.168.1.1
    if_index = 5, flags = 0x00002417
configd: network configuration changed.
configd: setting hostname to "MacBook-Pro.local"
configd: InterfaceNamer: en0 - AirPort confirmed (IONetworkController)
configd: InterfaceNamer: utun0 created
configd: InterfaceNamer: lo0 created
powerd: Setting DarkWake= NO
powerd: System state: FullWake
powerd: Thermal event: SYSTEM_POWER_SOURCE=AC Power
powerd: Battery charge: 92%
[CoreBluetooth] XPC connection established for process: bluetoothd
[CoreBluetooth] CBCentralManager initialized state: poweredOn
airportd: 802.11 driver version 9.6.7
airportd: Atheros Communications, Inc. AR938x [0x924D74DF]
airportd: Roaming to BSSID 09:A2:B9:C2:C5:EE
airportd: IPv4 address assigned: 192.168.1.249
airportd: IPv6 address assigned: fe80::1AB1:2368:C9E6:AAC3
11:40:12.195 [kernel] Process com.apple.cloudd [6217] launched
11:40:12.655 [kernel] Process com.apple.configd [7447] launched
11:40:12.654 [kernel] Process com.apple.locationd [2567] launched
11:40:12.989 [kernel] Process com.apple.locationd [6716] exited abnormally: signal 15
11:40:12.780 [kernel] Process com.apple.syslogd [3557] launched
11:40:12.722 [kernel] Process com.apple.powerd [1871] launched
11:40:12.644 [kernel] Process com.apple.powerd [410] exited abnormally: signal 9
11:40:12.440 [kernel] Process com.apple.coreduetd [8866] launched
11:40:12.546 [kernel] Process com.apple.logd [1790] launched
11:40:12.816 [kernel] Process com.apple.coreduetd [8781] launched
11:40:12.661 [kernel] Process com.apple.diskarbitrationd [4425] launched
11:40:12.046 [kernel] Process com.apple.mediaremoted [312] launched
11:40:12.590 [kernel] Process com.apple.cfprefsd [6293] launched
11:40:12.032 [kernel] Process com.apple.cfprefsd [4531] exited abnormally: signal 11
11:40:12.694 [kernel] Process com.apple.metadata.mds [7056] launched
11:40:12.736 [kernel] Process com.apple.metadata.mds [6235] exited abnormally: signal 15
11:40:12.600 [kernel] Process com.apple.spindump [1632] launched
11:40:12.342 [kernel] Process com.apple.configd [407] launched
11:40:12.205 [kernel] Process com.apple.bluetoothd [9700] launched
11:40:12.571 [kernel] Process com.apple.logd [1910] launched
11:40:12.746 [kernel] Process com.apple.logd [2158] exited abnormally: signal 2
11:40:12.629 [kernel] Process com.apple.cfprefsd [9929] launched
11:40:12.264 [kernel] Process com.apple.cfprefsd [8853] exited abnormally: signal 1
11:40:12.566 [kernel] Process com.apple.cfprefsd [826] launched
11:40:12.412 [kernel] Process com.apple.cfprefsd [7754] exited abnormally: signal 7
11:40:12.790 [kernel] Process com.apple.locationd [9726] launched
11:40:12.714 [kernel] Process com.apple.symptomsd [5750] launched
WindowServer: Server starting
WindowServer: Running
WindowServer: Display 2 online: 1487x1215 @ 98Hz
WindowServer: Quartz Compositor 5.0.7
WindowServer: SkyLight server started
coreaudiod: AudioObjectID=77, kAudioHardwarePropertyDevices
coreaudiod: AppleHDAController: output device 'Built-in Output' online
coreaudiod: AppleHDAController: input device 'Built-in Microphone' online
securityd: starting Security Services daemon
securityd: keychain: /Library/Keychains/System.keychain
securityd: authorization: /etc/authorization loaded
securityd: CDSA initialized successfully
trustd: trust store version: 3145
trustd: root cert count: 154
11:40:12.672 kextd: starting com.apple.driver.AppleTopCaseHIDEventDriver v10.7.3
11:40:12.479 kextd: starting com.apple.driver.AppleRTC v5.7.1
11:40:12.035 kextd: starting com.apple.driver.AppleIntelLPSSPI v1.7.9
11:40:12.174 kextd: starting com.apple.driver.AppleSMBIOS v7.8.3
11:40:12.151 kextd: starting IOAHCIFamily v16.2.1
11:40:12.833 kextd: starting com.apple.filesystems.apfs v3.3.3
11:40:12.911 kextd: starting com.apple.kext.triggers v3.2.6
11:40:12.248 kextd: starting com.apple.driver.DiskImages v13.2.6
11:40:12.751 kextd: starting com.apple.driver.AppleTopCaseHIDEventDriver v17.8.9
11:40:12.415 kextd: starting com.apple.driver.X86PlatformPlugin v5.0.1
11:40:12.953 kextd: starting AppleThunderboltDPInAdapter v18.4.7
11:40:12.702 kextd: starting com.apple.driver.AppleSMBIOS v10.4.0
11:40:12.481 kextd: starting com.apple.driver.AppleHPET v19.6.0
11:40:12.566 kextd: starting com.apple.driver.X86PlatformPlugin v5.2.9
11:40:12.742 kextd: starting ApplePS2Controller v1.0.4
metadata: Spotlight server starting
metadata: com.apple.metadata.mds: [6026] enabled
metadata: Reindexing: NO
metadata: Volumes: /
diskarbitrationd: disk0s3 (4B132937-2F53-817B-8CC0-9AABBEE23986) appeared
diskarbitrationd: mount of disk0s2 succeeded
diskarbitrationd: disk1 synthesized
diskarbitrationd: mount of disk1s1 succeeded
locationd: starting Location Services
locationd: CoreLocation framework 14.5.9 initialized
locationd: geofence manager ready
sharingd: com.apple.sharingd: starting
sharingd: bonjour registered: _smb._tcp.
sharingd: bonjour registered: _afpovertcp._tcp.
backupd: Starting backup preparation
backupd: No backup destinations found
11:40:12.598 launchd: [6388] com.apple.syslogd: keepAlive=true, crashed=false
11:40:12.691 launchd: [2087] com.apple.systemstatsd: keepAlive=true, crashed=false
11:40:12.915 launchd: [5536] com.apple.diskarbitrationd: keepAlive=true, crashed=false
11:40:12.719 launchd: [7467] com.apple.powerd: keepAlive=true, crashed=false
11:40:12.076 launchd: [6228] com.apple.kextd: keepAlive=true, crashed=false
11:40:12.554 launchd: [6135] com.apple.opendirectoryd: keepAlive=true, crashed=true
11:40:12.271 launchd: [8092] com.apple.launchd: keepAlive=true, crashed=true
11:40:12.163 launchd: [5614] com.apple.syslogd: keepAlive=true, crashed=true
11:40:12.370 launchd: [6161] com.apple.WindowServer: keepAlive=true, crashed=true
11:40:12.343 launchd: [9151] com.apple.symptomsd: keepAlive=true, crashed=true
11:40:12.935 launchd: [4407] com.apple.launchd: keepAlive=true, crashed=true
11:40:12.313 launchd: [9046] com.apple.airportd: keepAlive=true, crashed=true
11:40:12.137 launchd: [9400] com.apple.locationd: keepAlive=true, crashed=false
11:40:12.058 launchd: [5098] com.apple.mDNSResponder: keepAlive=true, crashed=false
11:40:12.091 launchd: [1242] com.apple.configd: keepAlive=true, crashed=true
11:40:12.602 launchd: [1145] com.apple.thermalmonitord: keepAlive=true, crashed=false
11:40:12.170 launchd: [6460] com.apple.powerd: keepAlive=true, crashed=false
11:40:12.022 launchd: [3420] com.apple.symptomsd: keepAlive=true, crashed=true
11:40:12.572 launchd: [3555] com.apple.syslogd: keepAlive=true, crashed=false
11:40:12.656 launchd: [3172] com.apple.launchd: keepAlive=true, crashed=true
loginwindow: Login window initialized
loginwindow: Loading user list
loginwindow: Showing login screen
loginwindow: FileVault authenticated
loginwindow: User logged in: UID=638 GID=39
loginwindow: User environment initialized
11:40:12.186 assert: 0xB97A45CE kxld [com.apple.driver.AppleLPC]: OK (0x82D5A797)
11:40:12.739 com.apple.softwareupdated: [2635]: pid 1665 registered name A104F528-3556-401C-D62B-1E085B381F6B
11:40:12.640 com.apple.BootCache: driver probe score 68251
11:40:12.376 AppleHDA: driver probe score 2983
11:40:12.242 IOService: AppleUSBXHCI matched to com.apple.notifyd
11:40:12.392 com.apple.symptomsd: [9516]: pid 9001 registered name 3A1A28A9-582D-E9B3-222F-BB5CAD168B1D
11:40:12.872 com.apple.sharingd: [5296]: pid 2602 registered name 20BC2F68-B921-8EC1-01D9-B3C389FE273A
11:40:12.905 AppleEFINVRAM: driver probe score 80748
11:40:12.393 com.apple.BootCache: driver probe score 417
11:40:12.366 IOService: com.apple.driver.AppleGraphicsControl matched to com.apple.softwareupdated
11:40:12.401 com.apple.trustd: [2299]: pid 4224 registered name 1761E54A-BF4D-CB2A-26EB-96C948A5EF10
11:40:12.789 IOService: AppleIntelPCHSeriesAHCI matched to com.apple.cfprefsd
11:40:12.280 IOService: AppleACPIPlatform matched to com.apple.symptomsd
11:40:12.756 assert: 0xC0457BD1 kxld [IOAHCIFamily]: OK (0xE4ED9C9A)
11:40:12.055 IOService: com.apple.driver.AppleGraphicsControl matched to com.apple.tccd
11:40:12.053 IOService: com.apple.iokit.IOAHCIBlockStorage matched to com.apple.powerd
11:40:12.283 IOService: com.apple.driver.AppleIntelSlimHDA matched to com.apple.ctkd
11:40:12.498 com.apple.driver.X86PlatformPlugin: driver probe score 12935
11:40:12.698 IOService: AppleKeyStore matched to com.apple.thermalmonitord
11:40:12.137 IOService: com.apple.filesystems.apfs matched to com.apple.coreaudiod
11:40:12.406 IOService: com.apple.iokit.IONetworkingFamily matched to com.apple.logd
11:40:12.864 assert: 0x55F41A91 kxld [com.apple.driver.AppleEmbeddedAudio]: FAIL (0x03408E12)
11:40:12.853 assert: 0x593969A2 kxld [com.apple.iokit.IOAHCIBlockStorage]: OK (0xDD83C6C5)
11:40:12.851 AppleKeyStore: driver probe score 75237
11:40:12.082 assert: 0x9D5BD2CB kxld [com.apple.AMDRadeonX4000]: FAIL (0x5576D4B8)
11:40:12.739 assert: 0xF23DDC00 kxld [com.apple.iokit.IOThunderboltFamily]: OK (0x43C0C32A)
11:40:12.607 assert: 0x447C638E kxld [IOBluetoothHCIController]: OK (0x883D939C)
11:40:12.317 com.apple.driver.IOSlaveProcessor: driver probe score 96902
11:40:12.107 com.apple.nsurlsessiond: [514]: pid 4496 registered name EA61B86E-4E5C-AAD5-0516-BF29E55080A8
11:40:12.110 assert: 0x31FD2F2B kxld [AppleThunderboltDPInAdapter]: OK (0x6D2B02D1)
11:40:12.231 AppleACPIPlatform: driver probe score 97759
11:40:12.846 IOService: com.apple.driver.AppleFileSystemDriver matched to com.apple.airportd
11:40:12.333 IOService: AppleIntelPCHSeriesAHCI matched to com.apple.softwareupdated
11:40:12.995 IOService: com.apple.iokit.IOSurface matched to com.apple.airportd
11:40:12.148 ApplePS2Controller: driver probe score 91292
11:40:12.786 assert: 0xFB77E2D4 kxld [AppleKeyStore]: OK (0xFD80F0D4)
11:40:12.729 com.apple.driver.AppleMuxControl: driver probe score 18465
11:40:12.954 com.apple.symptomsd: [2312]: pid 4399 registered name 82ECD4C6-FCF7-DD40-768D-65777E1CA770
11:40:12.677 assert: 0x507E7FEF kxld [com.apple.driver.AppleLPC]: FAIL (0xCA19BC18)
11:40:12.093 com.apple.WindowServer: [5890]: pid 8583 registered name FA9CD351-B457-BBFD-8221-D360719931F4
11:40:12.267 com.apple.trustd: [5490]: pid 7939 registered name C4879FBF-0EDF-6A29-88B3-796E368DD41F
11:40:12.411 IOService: com.apple.driver.AppleRTC matched to com.apple.notifyd
11:40:12.074 IOService: com.apple.iokit.IOAHCIBlockStorage matched to com.apple.softwareupdated
11:40:12.607 IOService: com.apple.driver.AppleT2 matched to com.apple.syslogd
11:40:12.339 com.apple.driver.AppleT2: driver probe score 64186
11:40:12.659 com.apple.usbd: [5633]: pid 2113 registered name A797D689-308B-42BC-C75E-C8D24F30DE9B
11:40:12.521 AppleThunderboltDPInAdapter: driver probe score 65477
11:40:12.680 com.apple.driver.AppleCameraInterface: driver probe score 54460
11:40:12.382 IOService: com.apple.driver.AppleCameraInterface matched to com.apple.cfprefsd
11:40:12.039 com.apple.mtmd: [5889]: pid 3215 registered name 4638CD3D-F33F-0C67-EFBB-E673FA521461
System boot complete.
macOS Mojave (10.14.6) - Darwin 18.7.0
Welcome.`

export default function BootAnimation({ config, onComplete }: BootAnimationProps) {
  const [lines, setLines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);

  const isAppleStyle = config.style === 'apple';

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Prepare audio
    if (config.audioUrl) {
      audioRef.current = new Audio(config.audioUrl);
      audioRef.current.volume = 0.5;
    }

    let isRunning = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    const duration = config.durationMs || 5000;

    if (isAppleStyle) {
      // Apple style boot logic
      let currentProgress = 0;
      
      const updateProgress = () => {
        if (!isRunning) return;
        
        // Randomly determine the next chunk of progress and the delay
        const chunk = Math.random() * 15 + 2; // 2% to 17%
        currentProgress = Math.min(100, currentProgress + chunk);
        setProgress(currentProgress);
        
        if (currentProgress < 100) {
          // Random delay to simulate realistic loading (stopping/starting)
          const delay = Math.random() < 0.3 ? Math.random() * 800 + 400 : Math.random() * 300 + 50;
          timeoutId = setTimeout(updateProgress, delay);
        } else {
          timeoutId = setTimeout(() => {
            if (!isRunning) return;
            if (audioRef.current) {
              audioRef.current.play().catch(e => console.warn("Audio autoplay blocked", e));
            }
            onCompleteRef.current();
          }, 400);
        }
      };
      
      timeoutId = setTimeout(updateProgress, 300);
      
    } else {
      // Verbose boot logic
      const fullText = config.customText || DEFAULT_BOOT_TEXT;
      const allLines = fullText.split('\n');
      let currentIndex = 0;
      
      let baseSpeed = config.textSpeedMs || 50;
      if (allLines.length * baseSpeed > duration * 0.8) {
        baseSpeed = (duration * 0.8) / allLines.length;
      }

      const printNextLine = () => {
        if (!isRunning || currentIndex >= allLines.length) return;

        const lineToAdd = allLines[currentIndex];
        setLines(prev => [...prev, lineToAdd]);
        currentIndex++;

        let nextSpeed = baseSpeed;
        if (Math.random() < 0.15) {
          nextSpeed += Math.random() * 400 + 100;
        }

        timeoutId = setTimeout(printNextLine, nextSpeed);
      };

      timeoutId = setTimeout(printNextLine, baseSpeed);

      const completionTimeout = setTimeout(() => {
        isRunning = false;
        clearTimeout(timeoutId);
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.warn("Audio autoplay blocked", e));
        }
        onCompleteRef.current();
      }, duration);

      return () => {
        isRunning = false;
        clearTimeout(timeoutId);
        clearTimeout(completionTimeout);
      };
    }

    return () => {
      isRunning = false;
      clearTimeout(timeoutId);
    };
  }, [config.durationMs, config.textSpeedMs, config.audioUrl, config.customText, isAppleStyle]);

  useEffect(() => {
    if (!isAppleStyle && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, isAppleStyle]);

  const formatLine = (line: string) => {
    if (typeof line !== 'string') return null;
    let html = line
      .replace(/\bOK\b/g, '<span class="text-green-400 font-bold">OK</span>')
      .replace(/\b(?:NO|ERROR|FAILED|FAIL)\b/g, '<span class="text-red-500 font-bold">$&</span>')
      .replace(/\b([a-z]+\.[a-z]+\.[a-zA-Z0-9.]+)\b/g, '<span class="text-blue-400">$&</span>')
      .replace(/(?:\/[a-zA-Z0-9_-]+)+/g, '<span class="text-yellow-400">$&</span>')
      .replace(/\[.*?\]/g, '<span class="text-gray-400">$&</span>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const [hasInteracted, setHasInteracted] = useState(false);

  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      // Unlock audio for mobile browsers by playing and pausing immediately
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          if (audioRef.current) audioRef.current.currentTime = 0;
        }).catch(() => {});
      }
    }
  };

  if (isAppleStyle) {
    return (
      <div 
        className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center select-none"
        onClick={handleInteraction}
        onTouchStart={handleInteraction}
      >
        {!hasInteracted && config.audioUrl && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-max max-w-[90vw] text-xl text-gray-500 flex flex-wrap items-center justify-center gap-2 sm:gap-4 animate-pulse cursor-pointer z-10">
            <VolumeX size={24} className="shrink-0" /> 
            <span className="text-center">Tap anywhere to unmute</span>
          </div>
        )}
        <div className="flex flex-col items-center justify-center w-full max-w-sm mt-[-10vh]">
          {/* Apple Logo SVG or Custom Logo */}
          {config.appleLogoUrl ? (
            <img src={config.appleLogoUrl} alt="Boot Logo" className={`w-24 h-24 sm:w-32 sm:h-32 mb-16 object-contain ${config.invertAppleLogo ? 'invert' : ''}`} />
          ) : (
            <svg className="w-24 h-24 sm:w-32 sm:h-32 text-white mb-16" viewBox="0 0 384 512" fill="currentColor">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 24 184.8 8 273.7 0 318.5 13.3 408 55.4 466.8 75.4 494.7 99.3 512 127 512c26.5 0 38.6-16.7 70.8-16.7 32 0 42.9 16.7 71 16.7 27.6 0 50.8-16.8 70.2-44.6 23.3-33 34-66.2 34.6-67.6-1.5-.7-54.6-20.9-54.9-130.5M211.3 103.5c19.3-23.7 31.9-55.8 28.5-88-26.3 1-59 16.6-79.3 40.8-17.8 21.2-32 54.7-27.8 86.4 29.5 2.2 61-14.8 78.6-39.2z"/>
            </svg>
          )}
          
          {/* Progress Bar */}
          <div className="w-56 h-[5px] bg-[#333333] rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black z-[9999] text-gray-200 font-mono text-sm sm:text-base p-4 sm:p-8 overflow-hidden flex flex-col justify-end select-none"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {!hasInteracted && config.audioUrl && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-max max-w-[90vw] font-boot text-2xl sm:text-4xl text-gray-500 flex flex-wrap items-center justify-center gap-2 sm:gap-4 animate-pulse cursor-pointer">
          <VolumeX size={36} className="shrink-0" /> 
          <span className="text-center">Tap anywhere to unmute</span>
        </div>
      )}
      <div ref={containerRef} className="max-h-full overflow-y-auto pb-4 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {lines.map((line, i) => (
          <div key={i} className="mb-1 opacity-90 break-words">{formatLine(line)}</div>
        ))}
        {lines.length < (config.customText || DEFAULT_BOOT_TEXT).split('\n').length && (
          <div className="animate-pulse mb-1">_</div>
        )}
      </div>
    </div>
  );
}

