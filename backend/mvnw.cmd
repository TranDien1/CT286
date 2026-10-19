<# : batch portion
@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.  See the NOTICE file
@REM distributed with this work for additional information
@REM regarding copyright ownership.  The ASF licenses this file
@REM to you under the Apache License, Version 2.0 (the
@REM "License"); you may not use this file except in compliance
@REM with the License.  You may obtain a copy of the License at
@REM
@REM    http://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing,
@REM software distributed under the License is distributed on an
@REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
@REM KIND, either express or implied.  See the License for the
@REM specific language governing permissions and limitations
@REM under the License.
@REM ----------------------------------------------------------------------------

@REM Apache Maven Wrapper startup batch script, version 3.3.4
@IF "%__MVNW_ARG0_NAME__%"=="" (SET __MVNW_ARG0_NAME__=%~nx0)
@SET __MVNW_CMD__=
@SET __MVNW_ERROR__=
@SET __MVNW_PSMODULEP_SAVE=%PSModulePath%
@SET PSModulePath=
@FOR /F "usebackq tokens=1* delims==" %%A IN (`powershell -noprofile "& {$scriptDir='%~dp0'; $script='%__MVNW_ARG0_NAME__%'; icm -ScriptBlock ([Scriptblock]::Create((Get-Content -Raw '%~f0'))) -NoNewScope}"`) DO @(
  IF "%%A"=="MVN_CMD" (set __MVNW_CMD__=%%B) ELSE IF "%%B"=="" (echo %%A) ELSE (echo %%A=%%B)
)
@SET PSModulePath=%__MVNW_PSMODULEP_SAVE%
@SET __MVNW_PSMODULEP_SAVE=
@SET __MVNW_ARG0_NAME__=
@SET MVNW_USERNAME=
@SET MVNW_PASSWORD=
@IF NOT "%__MVNW_CMD__%"=="" ("%__MVNW_CMD__%" %*)
@echo Cannot start maven from wrapper >&2 && exit /b 1
@GOTO :EOF
: end batch / begin powershell #>

$ErrorActionPreference = "Stop"
if ($env:MVNW_VERBOSE -eq "true") {
  $VerbosePreference = "Continue"
}

$distributionUrl = (Get-Content -Raw "$scriptDir/.mvn/wrapper/maven-wrapper.properties" | ConvertFrom-StringData).distributionUrl
if (!$distributionUrl) {
  Write-Error "cannot read distributionUrl property in $scriptDir/.mvn/wrapper/maven-wrapper.properties"
}

switch -wildcard -casesensitive ($distributionUrl -replace '^.*/', '') {
  "maven-mvnd-*" {
    $useMvnd = $true
    $distributionUrl = $distributionUrl -replace '-bin\.[^.]*$', "-windows-amd64.zip"
    $mavenCommand = "mvnd.cmd"
    break
  }
  default {
    $useMvnd = $false
    $mavenCommand = $script -replace '^mvnw', 'mvn'
    break
  }
}

if ($env:MVNW_REPOURL) {
  $repoPattern = if ($useMvnd -eq $false) { "/org/apache/maven/" } else { "/maven/mvnd/" }
  $distributionUrl = "$env:MVNW_REPOURL$repoPattern$($distributionUrl -replace "^.*$repoPattern", '')"
}

$distributionName = $distributionUrl -replace '^.*/', ''
$distributionDirectory = $distributionName -replace '\.[^.]*$', '' -replace '-bin$', ''
$mavenUserHome = if ($env:MAVEN_USER_HOME) { $env:MAVEN_USER_HOME } else { Join-Path $HOME '.m2' }
$wrapperDists = Join-Path $mavenUserHome 'wrapper/dists'
$mavenHomeParent = Join-Path $wrapperDists $distributionDirectory
$distributionHash = ([System.Security.Cryptography.SHA256]::Create().ComputeHash([byte[]][char[]]$distributionUrl) | ForEach-Object { $_.ToString('x2') }) -join ''
$mavenHome = Join-Path $mavenHomeParent $distributionHash

if (Test-Path -Path $mavenHome -PathType Container) {
  Write-Output "MVN_CMD=$mavenHome/bin/$mavenCommand"
  exit $?
}

if (!$distributionDirectory -or ($distributionName -eq $distributionDirectory)) {
  Write-Error "distributionUrl is not valid, must end with *-bin.zip, but found $distributionUrl"
}

$tempFile = New-TemporaryFile
$tempDirectory = New-Item -ItemType Directory -Path "$tempFile.dir"
$tempFile.Delete() | Out-Null
trap {
  if ($tempDirectory.Exists) {
    Remove-Item $tempDirectory -Recurse -Force -ErrorAction SilentlyContinue
  }
}

New-Item -ItemType Directory -Path $mavenHomeParent -Force | Out-Null
$archivePath = Join-Path $tempDirectory $distributionName
$webClient = New-Object System.Net.WebClient
if ($env:MVNW_USERNAME -and $env:MVNW_PASSWORD) {
  $webClient.Credentials = New-Object System.Net.NetworkCredential($env:MVNW_USERNAME, $env:MVNW_PASSWORD)
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$webClient.DownloadFile($distributionUrl, $archivePath)
Expand-Archive $archivePath -DestinationPath $tempDirectory

$sourceDirectory = Join-Path $tempDirectory $distributionDirectory
if (!(Test-Path -Path (Join-Path $sourceDirectory "bin/$mavenCommand") -PathType Leaf)) {
  $sourceDirectory = Get-ChildItem -Path $tempDirectory -Directory | Where-Object {
    Test-Path -Path (Join-Path $_.FullName "bin/$mavenCommand") -PathType Leaf
  } | Select-Object -First 1 -ExpandProperty FullName
}
if (!$sourceDirectory) {
  Write-Error "Could not find Maven distribution directory in extracted archive"
}

Move-Item -Path $sourceDirectory -Destination $mavenHome
Remove-Item $tempDirectory -Recurse -Force -ErrorAction SilentlyContinue
Write-Output "MVN_CMD=$mavenHome/bin/$mavenCommand"
