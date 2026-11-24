#define MyAppName "Peptibra"
#define MyAppVersion "3.1.0"
#define MyAppPublisher "Monthyva"
#define MyAppExeName "Peptibra.exe"

[Setup]
AppId={{8F157A90-2E98-4A23-91C4-C2B18064FB29}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\Peptibra
DefaultGroupName=Peptibra
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=Peptibra-Setup-{#MyAppVersion}
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=yes
ArchitecturesAllowed=x64compatible

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "..\dist\Peptibra.exe"; DestDir: "{app}"; Flags: ignoreversion restartreplace

[Icons]
Name: "{autoprograms}\Peptibra"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Peptibra"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear un acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: checkedonce

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir Peptibra"; Flags: nowait postinstall skipifsilent
