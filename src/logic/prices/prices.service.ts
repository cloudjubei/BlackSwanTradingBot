import { Injectable } from '@nestjs/common'
import ArrayUtils from 'src/lib/arrayUtils'
import { getFile } from 'src/lib/storageUtils'
import ConfigModel from 'src/models/config/ConfigModel.dto'
import TokenPriceTimeModel from 'src/models/prices/TokenPriceTimeModel.dto'

@Injectable()
export class PricesService
{
    private ports: { [key: string]: number } = {}
    private cache: { [key: string]: TokenPriceTimeModel } = {}

    constructor()
    {
        const configFile = getFile('config.json')
        const config = JSON.parse(configFile) as ConfigModel
        for(const token in config.prices){
            this.add(token, config.prices[token])
        }
    }

    storeInCache(price: TokenPriceTimeModel)
    {
        this.cache[price.tokenPair] = price
    }
    getFromCache(token: string) : TokenPriceTimeModel
    {
        return this.cache[token]
    }
  
    getAllTokens() : string[]
    {
        return Object.keys(this.ports)
    }
    getAllPorts() : number[]
    {
        return ArrayUtils.FilterUnique(Object.values(this.ports))
    }

    hasToken(token: string) : boolean
    {
        return this.ports[token] !== undefined
    }
    getPort(token: string) : number | undefined
    {
        return this.ports[token]
    }

    add(token: string, port: number)
    {
        this.ports[token] = port
        this.cache[token] = new TokenPriceTimeModel(token, '0', 0)
    }

    remove(token: string) : number
    {
        const port = this.ports[token]
        delete this.cache[token]
        delete this.ports[token]
        return port
    }
}