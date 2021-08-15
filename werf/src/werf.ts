import tl=require('azure-pipelines-task-lib')
//import download=require('azure-pipelines-tasks-utility-common/downloadutility')
import  toolLib = require('azure-pipelines-tool-lib/tool');
import * as handlers from 'typed-rest-client/Handlers'
import path = require("path");
import fs = require("fs");
import acrauthenticationtokenprovider = require('azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/acrauthenticationtokenprovider');
import genericauthenticationtokenprovider = require("azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/genericauthenticationtokenprovider");
import AuthenticationTokenProvider from 'azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/authenticationtokenprovider';
import os = require("os");
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { IRequestHandler } from 'typed-rest-client/Interfaces';


var userDir = getNewUserDirPath();
run()

function addConvergeCommandArgs(commandToExecute:ToolRunner){        
    if (tl.getInput("sendDockerConfigToChart")??false) { 
       commandToExecute.arg("--set-docker-config-json-value=true")      
    }
    commandToExecute.arg("--home-dir="+userDir);   
    var dockerPath = downloadDockerConfigFromEndpoint();
    fs.chmodSync(dockerPath+"/config.json", "777");
    commandToExecute.arg("--docker-config="+dockerPath);
    var dockerServer = getDockerServerName();
    commandToExecute.arg("--repo="+ dockerServer + "/" + (tl.getInput("layerRepo",true)));
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
    commandToExecute.arg("--home-dir="+userDir);   
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


async function run() : Promise<void> {
    const command  = tl.getInput("command",true)!;   

    var path : string;
    try {  
       path = await getWerfPath(); 
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed,error.message)
        return;
    }
    var commandToExecute = tl.tool(path);       
    commandToExecute.arg(command);    
       
    if (command == "converge"){
        addConvergeCommandArgs(commandToExecute);
    }
    if (command == "dismiss"){
        addDismissCommandArgs(commandToExecute);
    }

    commandToExecute.line(tl.getInput("arguments",false)??"");     
    try{
      await commandToExecute.exec();
      tl.setResult(tl.TaskResult.Succeeded,"werf completed");
    } catch (error){
      tl.setResult(tl.TaskResult.Failed,error.message)
    }                         
    
}

async function  getWerfPath(){
    var location = tl.getInput("versionOrLocation",true)!;
    if (location == 'location'){
       return tl.getPathInput("specifyLocation",true,true)!;
    }
    else  if (location == 'version'){
       var version:string = tl.getInput("versionSpec")!;
       var channel:string = tl.getInput("versionChannel")!;             
     
       let cachedToolpath = toolLib.findLocalTool("multiwerf", "1.0.0");
       if (!cachedToolpath){
          var path = await toolLib.downloadTool("https://raw.githubusercontent.com/werf/multiwerf/master/get.sh","./get.sh");           
          fs.chmodSync(path, "777");            
          var res = tl.execSync(path,[]).stderr;  
          if (res)  {
             tl.warning(res);             
          }         
      //    fs.chmodSync("./multiwerf", "777"); 
          await toolLib.cacheFile("./multiwerf","multiwerf","multiwerf","1.0.0");
          cachedToolpath = toolLib.findLocalTool("multiwerf", "1.0.0");
       }         
       await tl.tool(cachedToolpath+"/multiwerf").arg("use").arg(version).arg(channel).arg("--as-file").exec();
      
       return "/usr/local/bin/werf";
    }
    else{
        let cachedToolpath = toolLib.findLocalTool("werf", "0.0.0");
        if (!cachedToolpath || !tl.getBoolInput("downloadOnce")){
           var auth:IRequestHandler[] = [];
           if (tl.getInput("user")) {
                auth = [new handlers.BasicCredentialHandler(tl.getInput("user")!, tl.getInput("password")!)]
           }
           var path = await toolLib.downloadTool(tl.getInput("specifyUri",true)!,"./werf",auth);           
           fs.chmodSync(path, "777");                                
           await toolLib.cacheFile(path,"werf","werf","0.0.0");
           cachedToolpath = toolLib.findLocalTool("werf", "0.0.0");          
        }        
        return cachedToolpath + "/werf"; 
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