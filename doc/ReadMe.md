（一）程序入口:varpomelo=require('pomelo');
pomelo/lib/pomelo.js为程序的框架入口文件。分析：pomelo.js里面主要做3件事：
1.为自身绑定app属性，关联到整个application.js应用程序。Application.js是整个pomelo的核心内容。
2.读取lib/components/目录下所有js文件，并绑定load方法以便require到pomelo.components对象为其设置get属性，同时也将其设置为pomelo本身的get属性:pomelo.components.组件名，pomelo.组件名
3.读取lib/filters/handler目录下所有js文件，并绑定load方法以便require到pomelo.filters对象为其设置get属性，同时也将其设置为pomelo本身的get属性：pomelo.filters.filter名，pomelo.filter
名读取lib/filters/rpc目录下所有js文件，并绑定load方法以便require到pomelo.rpcFilters对象为其设置get属性:pomelo.rpcFilters.filter名,注意,这里没有将其设置为pomelo的get属性。

（二）Pomelo程序的创建和初始化:读取相关配置文件，进行必要的初始化工作：
varapp=pomelo.createApp();//创建pomelo应用程序主要的代码在appUtil.js里的defaultConfiguration函数,初始化pomelo的默认配置文件。
具体这几个函数里层的东西就不再跟进。

setupEnv(app,args);//设置环境为development还是production
loadMaster(app);//读取/config/master.json初始化app.master属性
loadServers(app);//读取/config/servers.json初始化app.servers属性
processArgs(app,args);//解析命令行参数，并且为app.serverType,app.serverId,app.mode,app.curServer,app.type等赋值,
当启动加入masterha参数时，app.master,app.curServer会被args重新覆盖。
configLogger(app);//读取/config/log4js.json，初始化pomelo-logger日志插件
loadLifecycle(app);//读取/lifecycle.js文件，初始化app.lifecycleCbs数组（该配置文件好像是pomelo1.0.0新增的），app.lifecycleCbs会在后面各个服务器启动的时候用到，用来判断各个服务器执行前后是否需要进行某些前置或者后置操作。
如beforeStartup，beforeShutdown，afterStartup，afterStartAll。

（三）加载针对各个服务器的配置。(注意该步骤不是pomelo自动调用，需要用户手工调用)Pomelo针对各个服务器的配置，可以使全局的，也可以是独立，全局配置会影响到所有服务器，独立配置只影响它配置的那台服务器。
（具体可配置参数，参考HelloWorld或者Pomelowiki教程）app.configure:该函数会根据当前服务器运行的环境（production或者development），当前服务器type去判断是否在配置参数里存在，存在则回调，否则不回调。

（四）Pomelo程序的启动(启动pomelo的application上面代码)
1.appUtil.startByType:根据服务器的类型走两条不同的分支，如果是master服务器则直接回调，如果是普通服务器，则调用starter.runServers(app);启动该服务器。
因为刚启动时，此刻服务器类型为master，所以此时直接回调,代码如下图。
2.appUtil.loadDefaultComponents(self)：加载默认组件并存入app.components数组。其中master服务器的核心组件是master组件，负责启动和关闭master服务器。
注意：component组件是pomelo的核心，也造就了pomelo框架的高度灵活性，有关component的基础部分请参考wiki有关文档:下面各组件具体的组件我们后面再讨论。

master服务器有2个组件:master,monitor
后端服务器与前端服务器共有的组件:proxy, backendSession, channel, server, monitor
后端服务器特有组件:remote前端服务器特有组件:connection, connector, session, pushScheduler

3.appUtil.optComponents(self.loaded, Constants.RESERVED.START, function(err))：依次启动之前加载的各个组件，调用它们的start函数。
4.self.afterStart(cb);该函数里面其实也是调用的appUtil.optComponents函数依次遍历master服务器所加载的组件，然后执行他们的afterStart函数，从而进行服务器启动后的某系后续处理操作。

（五）master服务器的启动详解(主服务器启动)
通过前面的代码分析，我们看到master服务器的启动主要就是mater组件和monitor组件的启动过程。所以我们着重分析这两大组件。
(1)master组件(/components/master.js)master服务器启动时加载.前面我们提到过,master组件是由master服务器加载的，每个组件都有start和stop函数，通过调用它的start函数启动该组件。
我们看下master组件里面的代码会发现，master组件里面所有的逻辑其实都是通过调用/master/master.js实现的。启动master组件，其实就是调用/master/master.js的start函数，也就是说/master/master.js的start函数才是master服务器的启动入口。
我们再继续分析/master/master.js里面的代码：仔细看会发现，/master/master.js里面大部分逻辑代码是依赖masterConsole属性。
var admin = require('pomelo-admin'); 
this.masterConsole = admin.createMasterConsole(opts);
我们知道pomelo-admin是pomelo的插件,代码到这里我建议先看下pomelo-admin的git工程：https://github.com/NetEase/pomelo-admin,
有关用法。pomelo-admin也是块大骨头，后面有空再做分析。我们先分析下/master/master.js的构造函数，

有人会问使用zookeeper进行高可用性配置时app.set('masterConfig',{closeWatcher:true});有何作用，其实看到这里你应该就明白了。
closeWatcher是传给master/master.js构造函数作为参数的。好了，我们继续分析master组件的核心启动函数，也就是/master/master.js的start函数:

1.moduleUtil.registerDefaultModules(true,this.app,this.closeWatcher);我们看到/master/master.js的start函数里面注册了系统默认modules并存放到了app.__modules__对象里。
我们先看下注册系统默认组件的代码：默认情况下closeWatcher是没有关闭的（除非你使用了zookeeper进行高可用配置），而且systemMotor默认也是关闭的。
也就是说默认情况下只会注册3个模块:masterwatcher,watchServer(属于pomelo-admin),consoleregisterDefaultModules函数里面通过app.registerAdmin将需要注册的模块存入app.__modules__数组对象。

2.moduleUtil.loadModules(this,this.masterConsole);然后我们再看下加载已注册模块的代码，它主要就是遍历app.__modules__存放的所有module，然后调用其构造函数创建对象，
并通过consoleService.register注册个module。这里的consoleService，实际是pomelo-admin里的对象。3.moduleUtil.startModules(self.modules,function(err)
接下来通过调用各module的start函数，启动已加载的所有模块。startModule里面其实就是递归的调用各个模块的start函数启动各模块。
关于各个模块start函数里面所做的事这里暂时不跟进去了，后面有时间再单独做分析。pomelo的component和module的设计思想是一致的，
具有高度灵活和可扩展性,可以说正是这些零散的component和module才组织成了pomelo。用户可以根据自己需要自己添加自定义的component的module，具体操作指南wiki文档。
master组件默认加载了3个module(后面讲monitor组件的时候还会加载另一个组件)，pomelo-admin还提供了6个module5.starter.runServers(self.app);
starter.runServers是最终启动所有服务器的入口,我们看到varstarter=require('./starter');其实是引入的/master/starter.js。然后我们看看/master/starter.js的runServers函数代码：
runServers里面主要根据当前服务器服务器类型和id，来启动对应的服务器：
A.如果当前服务器是master服务器，则跳过。
B.如果当前服务器type字段设置为all，那么读取app.__serverMap__数组里面的所有server，并且调用run函数依次启动它们。这也是master服务器分别启动各server的核心代码。
C.如果当前服务器带有startId属性，那么直接代用run函数启动这台服务器。从上面我们可以看到，不管是启动所有服务器还是单独启动一台服务器，最终都是调用starter.js的run函数进行启动的,
所以starter.js的run函数才是各个普通server的启动入口。接下来我们就分析这个run函数：

从上面我们可以看到,run函数启动server时，主要有2种情况：
A：启动本地server，
也就是配置的server的host配置为本机ip。run函数读取程序的入口脚本(xx/app.js),然后读取该server有关信息加入到options数组作为启动参数，然后获取node所在运行的绝对路径，
最后调用starter.localrun去启动本机server。starter.localrun里面最终是调用node的child_process.spawn启动新进程来运行各个server的。
B：启动远程server，
需要先通过ssh免密码登陆(通过公钥秘钥登陆，需要提前配置好,详情参考wiki上Pomelo的分布式环境搭建)到远程server上。其实登陆到远程机器上后启动远程server的流程就和启动本机的流程一样了。
只不过需要保证远程机器上的代码目录结构和本机一致。启动远程server主要由starter.sshrun实现。接下来我们再分别看下：starter.localrun和starter.sshrun的代码：从上面我们可以看到，
启动本机server和远程server最终都是调的spawnProcess函数传入指定参数执行的。而sshrun远程启动server时，还需要传入一些额外的ssh登陆配置（比如ssh端口）。
关于ssh登陆参数用户可以在app.js中自己指定（例如:app.set('ssh_config_params',['-p8888']);//配置ssh登陆端口为8888）。
那么接下来我们在进去spawnProcess里面看看。
从上面我们看到spawnProcess函数主要是调用node的child_process.spawn开启新进程来启动server的。需要注意的是在开发环境下，
启动的各个server进程是没有脱离父进程（masterserver进程的），而在产品环境下，各server是脱离父进程独立运行的。这里我列出下启动本机server和启动远程server构造的完整命令供参考：
启动本机server："D:\ProgramFiles\nodejs\node.exe"--debug=3103F:\workspace\java\EZXY\release\GameTest\game-server\app.jsenv=developmentid=connector-server-1host=127.0.0.1port=3101clientPort=3102frontend=trueserverType=connector
启动远程server：ssh10.8.49.66-p8888&&cd"/usr/local/soft/workspace/node/pomelo/GameTest/game-server"&&"/var/local/node/bin/node"--debug=3103/usr/local/soft/workspace/node/pomelo/GameTest/game-server/app.jsenv=developmentid=connector-server-1host=10.8.49.66port=3101clientPort=3102frontend=trueserverType=connector
上面两条命令基本上就是node启动多服务器和分布式服务器的关键命令。我们知道pomelo的服务器分masterserver（主服务器）和普通server(从服务器)。它们都是由app.js作为启动脚本的，但是它们代码走的逻辑却是不一样的。
前面的内容直到这里我们讲的都是masterserver的启动逻辑。我们先把masterserver的逻辑分析完，后面再具体讲各个从服务器的启动逻辑。

(2)monitor组件(/components/monitor.js)通过前面的代码分析我们知道master服务器启动时，加载了2个组件：master组件和monitor组件，而master组件再前面内容已经花了很大篇幅做详解。
接下来我们就来分析下monitor组件的启动。对比master组件代码，你会发现它们很相似，monitor组件其实是依赖于require('monitor/monitor.js')来处理的（就好像master组件依赖于master/master.js）。
那么我们跟进monitor/monitor.js里面去看个究竟,通过对比master/master.js里面的代码，你会发现它们的代码非常类似。同样的，我们先分析/monitor/monitor.js的构造函数,
我们发现它里面也调用了pomelo-admin插件来创建了一个monitorConsole对象，而且/monitor/monitor.js代码里面很多地方都依赖这个monitorConsole对象，看来pomelo-admin这块大骨头是有必要啃一啃了。
我们将在后面内容分析pomelo-admin插件。同样的，我们重点分析/monitor/monitor.js的start函数，和/master/master.js的start函数类似，它也调用主要也是分3步：注册(moduleUtil.registerDefaultModules),
加载(moduleUtil.loadModules)，启动(moduleUtil.startModules)（该3步操作参考前面的分析）monitor的模块。需要提醒一点的是：monitor组件默认加载了3个模块:monitorwatcher（monitor组件特有）,
watchServer(属于pomelo-admin),console（master组件也要加载）前面我们提到过master组件默认也加载了3个模块，其中2个和monitor组件加载的是相同的。那么现在可以得出结论，
master服务器启动时总共会加载4个模块:
masterwatcher:master组件特有monitorwatcher:monitor组件特有watchServer(属于pomelo-admin),console:master,monitor组件共有关于上述4大组件的功能作用，
后面有时间再做分析。

（六）各分布式服务器的启动详解(后端服务器启动)
不管是主服务器还是从服务器的启动运行的都是同一份代码，
而前面分析master服务器的启动流程时，大部分代码已经分析过了，所以这次启动从服务器的流程就不再重复深入前面已经讲过的代码，只分析与master服务器不同的分支逻辑已经部分关键逻辑。
1.创建应用程序:varapp=pomelo.createApp();=>app.init(opts);=>appUtil.defaultConfiguration(this);defaultConfiguration与master服务器运行到这段代码不同的是:varargs=parseArgs(process.argv);
从process.argv解析出server启动的额外参数，然后调用processArgs(app,args);将process.argv解析出的参数信息赋值到当前server有关字段:（如：app.serverType,app.serverId,,app.curServer,app.type）。
而这些字段会在后面的程序，执行不同与master服务器的逻辑。
2.启动应用程序:app.start();=>appUtil.startByType=>appUtil.loadDefaultComponents(self);我们再看下appUtil.js的loadDefaultComponents函数：
虽然前面我们分析过该函数，但是那是master主服务器的逻辑分支，而现在从服务器走到这块代码时，将会进入里面的else分支，加载普通服务器默认组件。由于我目前测试环境运行的是chat服务器（配置了port端口），
所以将会加载下面的几个组件：后端服务器加载的component:proxy,remote（后端服务器独有）,backendSession,channel,server,monitor同时我们看到前端服务器加载的component:proxy，connection(前端独有)，
connector(前端独有)，session(前端独有)，pushScheduler(前端独有)，backendSession,channel,server,
monitor前面我们提到过Pomelo框架核心就是由各个component组件构成，
master服务器的启动实际上就是master组件和monitor组件的启动过程，同样我们基本上可以得出这样的道理：后端服务器的启动实际就是:proxy,remote,backendSession,channel,server,monitor组件的依次启动过程。
前端服务器的启动实际就是：proxy，connection，connector，session，pushScheduler，backendSession,channel,server,monitor组件的依次启动过程。
由于我目前测试的是chat后端服务器的启动过程(后面我们会再测试一台gate前端服务器看下它的启动逻辑),所以接下来我们继续分析后端服务器加载的组件。

3.proxy组件的启动
（1）proxy组件构造函数：上面的构造函数中主要为add_servers，remove_servers，replace_servers添加监听回调函数，
同时构造一个opts参数对象（该参数会传递给pomelo-rpc的client构造函数），然后传递给了genRpcClient(this.app,opts)；创建一个rpc客户端对象(该对象是整个proxy的核心对象)，
我们继续跟进genRpcClient函数：也就是说proxy组件的核心对象就是require('pomelo-rpc').client对象，它是依附于pomelo-rpc组件的。
同时Pomelo在rpc的实现上也比较灵活:opts.rpcClient.create(opts);允许用户使用自定义的rpc实现(需要实现rpc的接口)比如：
用pomelo-rpc-zeromq替代pomelo-rpc。这里我们没有配置pomelo-rpc-zeromq，还是使用pomelo默认的rpc实现（pomelo-rpc）。
（2）proxy组件的启动:我们看下proxy组件的start启动函数：
它主要判断app对象是否设置过rpc回调的过滤函数（rpcBefores，rpcAfters，rpcErrorHandler），
然后设置到pomelo-rpc的client对像的过滤函数中。
（3）proxy组件的启动后续工作:前面我们说过，每个组件的start函数完成后，紧接着会一次调用它们的afterStart函数做一些后续处理工作。
我们接着看：proxy组件的afterStart函数为app对象设置了两个属性（这里我其实不太认可这种做法，外部类是不应该给人家类动态添加属性的，这样很影响阅读，同时加大了两边的耦合性），
然后调用pomelo-rpc.client.start函数启动proxy组件：rpc->pomelo-rpc.client.proxies.userSysrpc->pomelo-rpc.client.proxies.sys从上面的代码分析我们可以看到：
整个proxy组件都在依靠pomelo-rpc的client进行处理。那么我们有必要介绍下：pomelo-rpc插件（git地址：https://github.com/NetEase/pomelo-rpc）
（4）pomelo-rpc的client对象简介:我们知道pomelo实现分布式服务器协调工作主要靠的就是rpc远程调用，各个服务器的协调工作肯定是通过CS结构通信的，
那么必然会牵涉到client客户端和server服务器端。这里我们先介绍它的客户端：pomelo-rpc.client(下个章节讲remote组件的时候会用到pomelo-rpc.server，
到时我们在介绍有关pomelo-rpcserver端部分)同样的，我们先看pomelo-rpc.client的构造函数和启动函数:returnStation.create(opts);
它的构造函数保存了proxy传过来的app对象和路由回调以及当前服务器id，同时，它将opts传递给mailstation.js的构造函数MailStation创建了_station对象。
而client的启动实际也是调用的_station.start启动的。所以_station对象正是pomelo-rpc.client对象的核心。
从上面MailStation构造函数中我们看到它保存了pomelo各服务器信息，以及各在线服务器信息，消息处理队列等等。代码看到这里不知道大家有没一个疑惑，
既然是CS架构，那么client端肯定会有connectserver的操作呀？
没错，我们在mailstation.js里搜索：connect(关键字会发现，客户端到服务器的connect操作是这样写的：varmailbox=self.mailboxes[serverId];
mailbox.connect(tracer,function(err)mailbox.connect(tracer,function(err);也就是说，
最终pomelo-rpc.client的核心通信实际上是通过tcp-mailbox.js进行的，而tcp-mailbox.js里面正好引用的是net库和pomelo-rpc.server进行tcp通信。

4.remote组件的启动
(1)remote组件构造函数：Remote组件构造函数除了保存当前app和opts参数外基本上就没干啥别的事。
(2)remote组件的启动:先直接上代码，start函数：很容易看出this.remote就是remote组件的核心对象。那么我们再看看this.remote的来源genRemote函数:varRemoteServer=require('pomelo-rpc').server;
看到这里会不会感觉和proxy的genRpcClient函数很像？没错!remote组件的核心对象就是pomelo-rpc.server。这里将remote服务器代码存放的路径和当前app传递给pomelo-rpc.server构造函数创建rpcserver对象。
既然pomelo-rpc是remote组件的核心，那我们就去看个究竟了。
(3)pomelo-rpc的servert对象简介:直接贴代码：从上面代码我们看到两个关键部分，一个是loadRemoteServices(opts.paths,opts.context)函数加载了pomelo在remote服务器处理的核心文件，
包括pomelo系统目录lib/common/remote和用户自定义remote服务器目录:app/servers/xxserver/remote。这也正是pomelo自动加载用户remote文件夹下xxRemote.js的关键代码。
然后我们又看到pomelo-rpc.server返回的实际是Gateway构造函数创建的对象。也就是说：gateway.js才是pomelo-rpc.server的核心。那好，我们接着分析gateway.js,先看构造函数：
我们看到Gateway构造函数判断是否设置了热更新参数reloadRemotes，如果设置了，它会监视所有remote文件的修改并且进行热更新。
同时我们还看到gateway.js的核心对象是this.acceptor=this.acceptorFactory.create(opts,function(tracer,msg,cb)也就说ws-acceptor.js文件才是gateway.js的核心。
创建this.acceptor对象后，它接着调用dispatcher.route进行rpc消息路由。我们跟进ws-acceptor.js文件去看下:相信大家已经看到rpc进行CS通信的server端核心通信代码了，
前面讲rpc-server.client的时候我们说到client端有connect操作，现在server端我们是不是看到了这个listen操作？好了，关于pomelo-rpc.server的有关部分我们就讲到这里。
有兴趣进行更加深入学习的请直接阅读pomelo-rpc插件源码。5.backendSession组件的启动我们看到backendSession主要是依赖common/service/backendSessionService.js文件，
然后它给app设置了两个属性：app.backendSessionService，app.localSessionService这两个属性实际是关联的同一个对象。我们接着跟进backendSessionService.js去看看。
(1)backendSessionService的构造函数:通过代码注释我们看到，BackendSessionService维护着前后端服务器的通信，它会在每个服务器启动的时候创建（具体介绍参考wiki）。
它构造函数除了保存当前app，基本没干别的事。而且它也没有启动的start函数，但是我们注意到它有一个create函数：我们注意到BackendSession里面有个this.__sessionService__，
而且注意观察的话会发现，BackendSession的很多函数操作都是借助于this.__sessionService__，也就是说this.__sessionService__是BackendSession的关键。
那么这个this.__sessionService__关联的是哪个文件呢？通过变量命令和文件命令规则，我们很容易猜到this.__sessionService__关联的就是lib/common/service/sessionService.js文件,
这里我们暂时不去深究sessionService.js里面的内容，我们只需要知道BackendSession的核心是sessionService.js文件。后面调试到该部分逻辑的时候我们再去分析它。

6.channel组件的启动我们看到channel组件的代码的写法和backendSession组件很相似，不过我们看到channel组件主要是依赖common/service/channelServic.js文件，然后它给app设置了一个属性：app.channelService。
同样我们跟进channelServic.js去看下。
(1)channelServic.js的构造函数:varChannelRemote=require('../remote/frontend/channelRemote');从构造函数中我们看到一个依赖变量
:this.channelRemote->remote/frontend/channelRemote.js:channelRemote.js的pushMessage和broadcast就是负责chanel对单用户发消息和广播channel消息的。
(2)channelServic.js的启动函数start:channelService.js的start函数主要就是读取本地缓存里先前游戏服务器channel数据，然后恢复这些数据，以保证channel数据不丢失。

7.server组件的启动
(1)server组件的构造函数:我们看到server组件的构造函数就创建了一个this.server对象，依赖于:server/server.js，同时它的启动函数start，以及启动后续处理函数afterStart都是直接调用this.server处理,
也就是说:server/server.js是server组件的核心。那么我们跟进server/server.js去看：server.js构造函数里面定义了：this.globalFilterService：全局服务器过滤函数this.filterService：
局部过滤函数this.handlerService：handler处理服务对象this.crons：保存定时器数组this.jobs：保存定时器回调函数数组并且为app添加了2个事件回调:add_crons,remove_crons从代码里看server.js好像大多在处理cron有关内容。
我们再看下server.js的启动函数。
(2)server/server.js的启动函数start:我们看到该函数主要做了4件事情：A.创建common/service/filterService.js对象，并且加载全局的app.filter()设置的filter，
存入到common/service/filterService.js对象的befores，afters数组。B.创建common/service/filterService.js对象，并且当前服务器app.filter()设置的filter存入到common/service/filterService.js对象的befores，
afters数组。C.创建common/service/handlerService.js对象。D.加载config/crons.json定义的crons保存到crons，jobs数组。上面4步过程中引入了2个新的依赖文件:common/service/filterService.js和
common/service/handlerService.js,我们先看下common/service/filterService.js：从上面的代码我们可以看到filterService.js主要定义了2个成员数组：this.befores，this.afters用来保存server/server.js
加载的全局和局部filter，然后在进入各个server的handler之前调用其beforeFilter函数，进入之后调用afterFilter函数。它也就相当于一个拦截器的效果。接着我们再分析第二个依赖文件:common/service/handlerService.js
我们看到它的构造函数里面除了判断是否传入handler的热更新参数外，基本没做啥别的事。那么我们再看看它主要的handle函数：从上面代码可以看出它根据客户端传来的routeRecord，
从当前server的handler目录下的所有handler文件里找出对应的handler，然后执行该handler里面routeRecord指定的函数名。代码看到这里，相信到家明白为何客户端只需要传递:connector.entryHandler.entry这种参数，
服务器就可以找到对应的handler处理文件去执行相应的逻辑处理了。
(3)server/server.js启动的后续处理函数afterStart:
afterStart函数就是启动前面config/crons.json配置的定时器任务执行。

8.monitor组件的启动测试前面master服务器部分已经分析过,这里跳过。
(七)各分布式服务器的启动详解(前端服务器启动)在前面章节：《
（六）各分布式服务器的启动详解(后端服务器启动)》中我们已经讲过各分布式服务器的启动流程，这里就不再重复。
前面我们是用chat-server-1作为测试的后端服务器。而我们前面也提到过，各分布式服务器的启动过程其实也就是各服务器默认组件的启动过程，
前面已经分析过,前端服务器加载的组件如下：proxy，connection(前端独有)，connector(前端独有)，session(前端独有)，pushScheduler(前端独有)，backendSession,channel,server,monitor
前面章节已经讲过proxy，backendSession，channel，server，monitor组件这里我们也不再重复。
本章节我们讲解前端服务器特有的4大组件的启动过程。
1.connection组件的启动(1)connection组件的构造函数:从上面的构造函数中我们看到，connection组件的构造函数其实就定义了一个this.service对象，而this.service是require的common/service/connectionService.js，
所以common/service/connectionService.js也就成了connection组件的核心。那好，我们就进connectionService.js去看看。
(2)common/service/connectionService.js(玩家数据统计):connectionService.js主要负责connector的玩家数据统计信息，比如连接数，当前登录人数,已经当前登录玩家的具体信息。
用过pomelo-cli或者pomelo-admin-web的人应该联想到了里面有个统计玩家人数的功能，其核心代码就在onnectionService.js。从我们目前分析过的所有pomelo组件来看，connection组件的代码是最简单也是最独立的。

2.connector组件的启动(1)connector组件的构造函数:
从connector组件构造函数我们看到，它的代码还是比较灵活，很多参数都可以通过app.js里配置对应的server获取：this.connector的创建可以在app.js里面的connectorConfig下的connector配置，pomelo提供的默认connector是sioconnector。当我们需要使用字典和probuf时需要配置connector为hybridconnector。同时还可以配置connector的自定义编码解码函数，传输消息是否加密，以及屏蔽某些黑名单连接connector的回调函数等。同时我们还看到，当app.js配置了connectorConfig的useDict和useProtobuf时，connector组件还会加载
另外两个组件：dictionary组件和protobuf组件(这两个组件我们稍后分析)。
(2)connector组件的启动函数start:我们看到connector组件的start函数里面获取了server，session和connection组件，也就是说connector组件要用到这3个组件。
(3)connector组件启动的后续处理afterStart:我们看到connector组件的启动实际就是启动用户配置的connector过程。我们这里因为要用到pomelo的字典和protobuf，所以选择的是hybridconnector连接器。Pomelo当前提供了4种类型的连接器如下：
4个connector的外部接口函数基本相同，只不过具体实现不同，我们先看看hybridconnector：
1.hybridconnector构造函数:从构造函数我们看到，主要保存了opts参数，同时创建了2个对象：this.handshake=newHandshake(opts);//握手对象,关联；commands/handshake.jsthis.heartbeat=newHeartbeat(opts);//心跳对象,关联；
commands/heartbeate.js
我们跟进去看下这两个文件：A.commands/handshake.js:注意看到handshake.js里面其实就是做了一系列的握手包处理，包括检查客户端，是否使用字典，是否使用protobuf，是否加密数据传输，然后把处理后的结果保存了opts参数继续向下传递。
B.commands/heartbeate.js我们看到heartbeate.js主要定义了几个数组：this.heartbeats，this.timeouts，this.clients用来保存各个客户端连接到当前server的心跳定时器，它的handle函数调用setTimeout设置了定时器，
每隔固定时间向客户端发送pomelo-protocol编码的心跳数据包，当客户端断开连接超时后会清空定时器。上面函数代码就是关于Pomelo前端服
务器心跳的处理过程。2.再看看hybridconnector的start函数:start函数主要有两条分支，通过传入的ssl参数判定：A.没有配置hybridconnector的ssl参数时：此时直接使用node的net.createServer()创建服务器，走的tcp协议，
然后监听server端口。我们还看到hybridconnector保存了dictionary和protobuf组件。同时hybridconnector还创建了一个this.switcher对象关联到hybrid/switcher.js文件。那我们就进去看看hybrid/switcher.js文件：
从switcher.js构造函数里我们看到，switcher定义了2个processor：this.wsprocessor=newWSProcessor();//关联：wsprocesso.jsthis.tcpprocessor=newTCPProcessor(opts.closeMethod);//关联：tcpprocessor.js，
在newSocket函数里面socketid进行自增处理（这也是为何客户端每连接一次有个socketid属性自增的原因）,然后它会根据达到的数据协议头进行判断，HTTP（websocket）协议和TCP协议分别调用不同的processor处理数据。
我们再分别看看这2个关联的processor文件,在处理“data”事件时，会调用processor.add(socket,data);
处理消息数据。a.wsprocessor.js:我们看到wsprocessor.js主要是处理ws协议的,它利用HttpServer创建WebSocketServer对象，然后自身的“connection”事件传递到外部switcher，其add函数，负责处理switcher的processHttp消息，
处理消息数据的关键代码：socket.ondata(data,0,data.length)。b.tcpprocessor.js:主要处理tcpsocket数据我们看到tcpprocessor.js主要依赖于tcpsocket.js，跟进tcpsocket.js看看：
我们看到tcpsocket.js引入了node的stream库，同时继承自Stream，再看看tcpsocket.js里面的函数，send，ondata，onend，readHead，readBody熟悉TCP协议的人应该很容易猜想到，这是在处理原生的TCP协议头和协议体，
以及TCP数据的解析和发送等等。
B.配置hybridconnector的ssl参数时：时hy使用ssl配置时，hybridconnector创建了一个this.tlssocket对象关联到hybrid/tlssocket.js文件。那我们跟进hybrid/tlssocket.js看看:
我们看到ssl参数目前支持两种协议：wss和ssl。a.wss协议处理的两行关键代码和ws协议的处理很类似，它们都是借助node的ws库，不同的是wss协议将依赖的http库换成了https库。b.ssl协议的处理同样可以类比tcp协议的处理。
首先在原生socket消息处理上它们都依赖于tcpsocket.js文件(前面已讲到过)。不同的是，ssl协议创建服务器时是依赖于node的tls库。C.不管是否使用ssl,当server收到客户端连接后，
hybridconnector会创建一个hybridsocket对象关联到：hybridsocket.js(其实Pomelo的4个connector都是类似的思路，每个connector都对应一个socket文件处理原生的server端socket协议通信)，
同时为其绑定”handshake,heartbeat,disconnect,closing”事件的回调，然后触发”connection”事件。我们跟进hybridsocket.js看看：我们看到构造函数里面引入了:handler(self,msg);//调用handler处理消息：handler关联common/handler.js,
函用以处理message事件。同时hybridsocket.js定义了好几个send有关的函数，其实注意观察会发现这些send有关的函数最终都是调用的socket对象（也就是前面讲述的ws，wss，tcp，ssl协议有关的tlssocket.js，tcpsocket.js）
的send函数向客户端发送消息。接着我们跟进去common/handler.js看看：handler.js里定义了4种类型的消息处理函数，其handle函数首先取出消息体的type字段，然后分析其所属消息类型(握手消息类型，握手确认消息类型，心跳消息类型，数据消息类型)，
执行对应的消息处理函数。

3.session组件的启动我们看到exports的时候，设置了app.sessionService属性，同时我们还看到了this.service对象，它依赖于：common/service/sessionService.js文件。看到这里不知道大家是否还记得我在讲backendSessionService时说道，
backendSessionService组件的核心也是依赖sessionService.js。下面我们就跟进common/service/sessionService.js里面去看看。SessionService主要定义了2个数组：
this.sessions={};//存放所有的session数组:key:sessionidthis.uidMap={};//存放所有的session数组:key:uid同时我们还看到这里面有好多我们在pomelo官网api里面看到的函数。没错，这就是关于sessionapi里面提到的函数源码，
其实你去读一下这些函数的实现就会发现，它们基本上就是在对this.sessions和this.uidMap数组就行处理。this.sessions里面存放是所有的客户端sessions，this.uidMap存放的是已绑定过uid的sessions。大家注意到，
SessionService的create函数里面创建了一个session对象：varsession=newSession(sid,frontendId,socket,this);注意观察注释里面的描述：Session类有两个代理类，一个是BackendSession类用于后端服务器，
另一个是FrontendSession用于前端服务器。Session里面定义了一个this.settings数组，用于保存自定义的session数据（通过session.set，session.get函数使用），同时this.__socket__保存了原生socket对象，用于send发送数据，
关闭连接之类。再注意到Session有个toFrontendSession函数里创建了FrontendSession对象。FrontendSession主要就是克隆了Session类的属性，然后this.__session__还保存了原始的Session对象。FrontendSession是专门提供给前端服务器用的。
4.pushScheduler组件的启动(1)pushScheduler组件的构造函数:
我们看到pushScheduler组件的构造函数创建了一个this.scheduler对象，默认情况下这个this.scheduler对象关联到pushSchedulers/direct.js文件，但是用户可以通过app.js里配置pushSchedulerConfig添加自定义的scheduler。
同时我们还看到pushScheduler
组件的3个函数afterStart，stop，schedule实际上都是调用的自身scheduler对象在处理。它们通过自身isSelectable属性判断是默认的scheduler还是用户定义的schedulers，然后分别调用这些scheduler的对应函数。
这里我们没有配置pushSchedulerConfig参数，还是用它默认的pushSchedulers/direct.js，看下它里面代码：
我们看到它的schedule函数主要就是发送广播消息和批量发送消息。从doBroadcast和doBatchPush函数我们看到，不管是广播消息还是批量给指定用户发消息，最后发消息都是利用sessionService发送的。
它们依赖于2个服务器类：channelService.js和sessionService.js。这两个服务类我们前面已经讲到过，这里不再重复。
由于当前gate服务器用到了字典和protobuf，所有我们顺便讲下Pomelo的最后两个组件:dictionary,protobuf。5.dictionary组件的启动
(1)dictionary组件的构造函数dictionary字典主要定义了2个数组：this.dict={};//字典数据数组:route->indexthis.abbrs={};//字典逆向数组:index->route用于保存系统预定义字典和用户定义字典，同时，
字典的加载配置文件也比较灵活，优先加载用户传入的字典配置路径，没有传入opts.dict参数时才使用pomelp默认字典配置：config/dictionary.json路径。(2)dictionary组件的启动start函数：
start函数首先加载各个server的handler文件保存到this.dict,this.abbrs数组，然后对齐排序，接着加载用户定义的字典数据push到this.dict,this.abbrs数组。不难看出this.dict,this.abbrs数组就是dictionary组件的核心，
而它对外提供的getDict和getAbbrs函数用于分别获取这两个数组。
6.protobuf组件的启动(1)protobuf组件的构造函数构造函数主要加载服务器端和客户端protobuf配置文件,加载的顺序是：优先使用用户配置路径，然后是config/xxxProtos.json,然后才是pomelo1.0新增的根据文件夹配置路径
（默认服务器端:config/serverProtos.json,客户端:config/clientProtos.json）。然后分别读取服务器和客户端protobuf数据保存到this.serverProtos和this.clientProtos数组。同时大家注意到这里有个this.watchers数组，
它是用来监视protobuf文件的实时修改的，通过protobuf文件的修改时间作为其版本号，对其热更新。
再注意看下，protobuf在处理数据的编码解码上其实是依赖于varprotobuf=require('pomelo-protobuf');的，也就是说protobuf组件的核心是pomelo-protobuf插件，它实现了googleprotobuf到pomelojson格式数据的转换，
有兴趣深入了解的可以跟进pomelo-protobuf源码看看。未完待续，请关注90度生活网本文作者：独孤小西http://www.mylife90.cn