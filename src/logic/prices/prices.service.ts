import { Injectable } from '@nestjs/common'
import ArrayUtils from "commons/lib/arrayUtils"
import { IdentityService } from 'logic/identity/identity.service'
import ConfigConnectionInputModel, { ConfigConnectionInputModelUtils } from 'commons/models/config/ConfigConnectionInputModel.dto'
import PriceKlineCache from 'commons/models/cache/PriceKlineCache'
import PriceKlineModel from 'commons/models/price/PriceKlineModel.dto'

@Injectable()
export class PricesService
{
    private urls: { [key: string]: string } = {}
    private cache = new PriceKlineCache()

    constructor(
        private readonly identityService: IdentityService,
    )
    {
        const config = this.identityService.config
        for(const token of Object.keys(config.prices)){
            this.add(token, config.intervals, config.prices[token])
        }
    }

    storeInCache(price: PriceKlineModel)
    {
        this.cache.storeKline(price)
    }
    getFromCache(token: string, interval: string) : PriceKlineModel
    {
        return this.cache.getLatest(token, interval)
    }
    getAllFromCache(token: string, interval: string) : PriceKlineModel[]
    {
        return this.cache.getAll(token, interval)
    }
  
    getAllTokens() : string[]
    {
        return this.cache.getAllKeys()
    }
    getAllIntervals(token: string) : string[]
    {
        return this.cache.getAllInternalKeys(token)
    }
    getAllUrls() : string[]
    {
        return ArrayUtils.FilterUnique(Object.values(this.urls))
    }

    hasToken(token: string) : boolean
    {
        return this.urls[token] !== undefined
    }
    getUrl(token: string) : string | undefined
    {
        return this.urls[token]
    }

    add(token: string, intervals: string[], config: ConfigConnectionInputModel)
    {
        this.urls[token] = ConfigConnectionInputModelUtils.GetUrl(config)
        this.cache.setup([token], intervals, 100)
    }

    remove(token: string) : string
    {
        const url = this.urls[token]
        delete this.cache[token]
        delete this.urls[token]
        return url
    }
}