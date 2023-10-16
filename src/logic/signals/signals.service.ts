import { Injectable } from '@nestjs/common'
import SignalCache from 'commons/models/cache/SignalCache'
import SignalModel from 'commons/models/signal/SignalModel.dto'
import ConfigSignalInputModel from 'commons/models/config/ConfigSignalInputModel.dto'
import { IdentityService } from 'logic/identity/identity.service'

@Injectable()
export class SignalsService
{
    private caches : { [id:string] : SignalCache } = {}
    private urls: { [id: string]: string } = {}

    constructor(
        private readonly identityService: IdentityService,
    )
    {
        const config = this.identityService.config
        for(const signal of Object.keys(config.signals)){
            this.add(signal, config.signals[signal])
        }
    }

    storeInCache(id: string, signal: SignalModel)
    {
        this.caches[id]?.storeSignal(signal)
    }
    getFromCache(id: string, tokenPair: string, interval: string) : SignalModel
    {
        return this.caches[id]?.getLatest(tokenPair, interval)
    }
  
    getAllSignals() : string[]
    {
        return Object.keys(this.urls)
    }
    getAllUrls() : string[]
    {
        return Object.values(this.urls)
    }

    hasSignal(signal: string) : boolean
    {
        return this.urls[signal] !== undefined
    }
    getSignalUrl(signal: string) : string | undefined
    {
        return this.urls[signal]
    }
    getSignalTokens(signal: string) : string[]
    {
        return this.caches[signal]?.getAllKeys() ?? []
    }
    getSignalIntervals(signal: string, token: string) : string[]
    {
        return this.caches[signal]?.getAllInternalKeys(token) ?? []
    }

    hasUrl(url: string) : boolean
    {
        return this.getAllUrls().find(p => p === url) !== undefined
    }

    add(id: string, config: ConfigSignalInputModel)
    {
        this.urls[id] = config.host + ':' + config.port
        this.caches[id] = new SignalCache()

        this.caches[id].setup(config.tokens, config.intervals, 100)
    }

    removeSignal(signal: string)
    {
        delete this.caches[signal]
        delete this.urls[signal]
    }
}