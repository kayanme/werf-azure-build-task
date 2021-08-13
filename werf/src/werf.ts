import tl=require('azure-pipelines-task-lib')
import path = require("path");
import fs = require("fs");
import acrauthenticationtokenprovider = require('azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/acrauthenticationtokenprovider');
import genericauthenticationtokenprovider = require("azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/genericauthenticationtokenprovider");
import AuthenticationTokenProvider from 'azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/authenticationtokenprovider';
import os = require("os");
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';


var userDir = getNewUserDirPath();
run();

function addConvergeCommandArgs(commandToExecute:ToolRunner){        
    if (tl.getInput("sendDockerConfigToChart")??false) { 
       commandToExecute.arg("--set-docker-config-json-value=true")      
    }
    var dockerPath = downloadDockerConfigFromEndpoint();
    fs.chmodSync(dockerPath+"/config.json", "777");
    commandToExecute.arg("--docker-config="+dockerPath);
    var dockerServer = getDockerServerName();
    commandToExecute.arg("--repo="+ dockerServer + (tl.getInput("layerRepo",true)));
    var registryType:string;
    if (tl.getInput("containerRegistryType", true) == 'Azure Container Registry'){
        registryType = "acr"
    }
    else{
        registryType = "default"
    }
    commandToExecute.arg("--repo-container-registry="+registryType);
    if (tl.getInput("namespace") != undefined){
        commandToExecute.arg("--namespace="+tl.getInput("namespace"));
     }
    var kubeConfigPath = downloadKubeconfigFileFromEndpoint();
    fs.chmodSync(kubeConfigPath, "777");
    commandToExecute.arg("--kube-config="+kubeConfigPath+"");
    
}


function addDismissCommandArgs(commandToExecute:ToolRunner){               
    var dockerPath = downloadDockerConfigFromEndpoint();
    fs.chmodSync(dockerPath+"/config.json", "777");
    commandToExecute.arg("--docker-config="+dockerPath);
    var dockerServer = getDockerServerName();
    commandToExecute.arg("--repo="+ dockerServer + (tl.getInput("layerRepo",true)));
    var registryType:string;
    if (tl.getInput("containerRegistryType", true) == 'Azure Container Registry'){
        registryType = "acr"
    }
    else{
        registryType = "default"
    }
    commandToExecute.arg("--repo-container-registry="+registryType);
    if (tl.getInput("namespace") != undefined){
       commandToExecute.arg("--namespace="+tl.getInput("namespace"));
    }
    var kubeConfigPath = downloadKubeconfigFileFromEndpoint();
    fs.chmodSync(kubeConfigPath, "777");
    commandToExecute.arg("--kube-config="+kubeConfigPath);
    
}


function run() {
    const command  = tl.getInput("command",true)!;    
    var commandToExecute = tl.tool(getWerfPath());       
    commandToExecute.arg(command);    
    commandToExecute.arg("--home-dir="+userDir);       
    if (command == "converge"){
        addConvergeCommandArgs(commandToExecute);
    }
    if (command == "dismiss"){
        addDismissCommandArgs(commandToExecute);
    }

    commandToExecute.line(tl.getInput("arguments",false)??"");    
    commandToExecute.exec().then(()=> tl.setResult(tl.TaskResult.Succeeded,"werf completed"),(error)=>tl.setResult(tl.TaskResult.Failed,error.message))
                           .catch((error)=>tl.setResult(tl.TaskResult.Failed,error.message)).done();
    
}

function getWerfPath():string{
    if (tl.getInput("versionOrLocation") == 'location'){
       return tl.getPathInput("specifyLocation",true,true)!;
    }
    else{
       var version:string = tl.getInput("versionSpec")!;
       var channel:string = tl.getInput("versionChannel")!;       
       tl.execSync("curl",["-L", "https://raw.githubusercontent.com/werf/multiwerf/master/get.sh", "|", "bash"]);
       tl.execSync("./multiwerf", ["use", version, channel, "--as-file"])
       return "/usr/local/bin/werf";
    }
}
function getDockerToken(){
    var registryType = tl.getInput("containerRegistryType", true);
    var authenticationProvider : AuthenticationTokenProvider;
    if (registryType == "Azure Container Registry") {
      authenticationProvider = new acrauthenticationtokenprovider.default(tl.getInput("azureSubscriptionEndpoint",true), tl.getInput("azureContainerRegistry",true));
    }
    else {
      authenticationProvider = new genericauthenticationtokenprovider.default(tl.getInput("dockerRegistryEndpoint",true));
    }
    return authenticationProvider.getAuthenticationToken();
}
function getDockerServerName():string{    
    return getDockerToken().getLoginServerUrl().replace("https://","");
}

function downloadDockerConfigFromEndpoint():string {
    var config =  getDockerToken().getDockerConfig();
    var dockerconfigFile = path.join(userDir, "config.json");
    fs.writeFileSync(dockerconfigFile, config!);
    return userDir;
}

function downloadKubeconfigFileFromEndpoint() :string {
    if (tl.getBoolInput("useConfigurationFile",true)){
       return tl.getInput("configuration",true)!;
    } 
    else{
      var kubernetesEndpoint = tl.getInput("kubernetesServiceEndpoint",true)!;
      var kubeconfigFile = path.join(userDir, "kubeconfig");
      var kubeconfig  = tl.getEndpointAuthorizationParameter(kubernetesEndpoint, 'kubeconfig', false);
    
      fs.writeFileSync(kubeconfigFile, kubeconfig!);
      return kubeconfigFile;
    }
}



function getTempDirectory() {
    return os.tmpdir();
}

function getCurrentTime() {
    return new Date().getTime();
}

function getNewUserDirPath() {
    var userDir = path.join(getTempDirectory(), "werfTask");
    ensureDirExists(userDir);
    userDir = path.join(userDir, getCurrentTime().toString());
    ensureDirExists(userDir);
    return userDir;
}

function ensureDirExists(dirPath:string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}