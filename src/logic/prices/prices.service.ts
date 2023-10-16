import { Injectable } from '@nestjs/common'
import ArrayUtils from "commons/lib/arrayUtils"
import PriceModel from "commons/models/price/PriceModel.dto"
import PriceCache from 'commons/models/cache/PriceCache'
import { IdentityService } from 'logic/identity/identity.service'
import ConfigPriceInputModel from 'commons/models/config/ConfigPriceInputModel.dto'

@Injectable()
export class PricesService
{
    private urls: { [key: string]: string } = {}
    private cache = new PriceCache()

    constructor(
        private readonly identityService: IdentityService,
    )
    {
        const config = this.identityService.config
        for(const token of Object.keys(config.prices)){
            this.add(token, config.intervals, config.prices[token])
        }
    }

    storeInCache(price: PriceModel)
    {
        this.cache.storePrice(price)
    }
    getFromCache(token: string, interval: string) : PriceModel
    {
        return this.cache.getLatest(token, interval)
    }
  
    getAllTokens() : string[]
    {
        return Object.keys(this.urls)
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

    add(token: string, intervals: string[], config: ConfigPriceInputModel)
    {
        this.urls[token] = config.host + ':' + config.port
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