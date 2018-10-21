import { 
    TextDocumentContentProvider,
    EventEmitter,
    Uri,
    Event,
    CancellationToken,
    ProviderResult
} from 'vscode';

export class EmailDocumentContentProvider implements TextDocumentContentProvider {
    private emitter = new EventEmitter<Uri>();

    onDidChange: Event<Uri> = this.emitter.event;

    provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
        console.log('provideTextDocumentContent');
        return 'Hello Eml';
    }

    update(uri: Uri) {
        console.log('update');
        this.emitter.fire(uri);
    }
}