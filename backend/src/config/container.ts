import {Container} from "inversify";
import {ZipService} from "../services/zip.service";
import {ProtocService} from "../services/protoc.service";
import {ParserController} from "../api/controllers/parser.controller";
import {ProxyService} from "../services/proxy.service";
import {SenderController} from "../api/controllers/sender.controller";

const container = new Container();

// Register services
container.bind<ZipService>('ZipService').to(ZipService);
container.bind<ProtocService>('ProtocService').to(ProtocService);
container.bind<ProxyService>('ProxyService').to(ProxyService);

// Bind controllers
container.bind<ParserController>('ParserController').to(ParserController);
container.bind<SenderController>('SenderController').to(SenderController);

export { container };