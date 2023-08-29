import { Injectable } from '@nestjs/common'
import { createOrWriteToFile, getFile } from 'src/lib/storageUtils'
import TradingSetupConfigModel from 'src/models/trading/TradingSetupConfigModel.dto'
import TradingSetupModel from 'src/models/trading/TradingSetupModel.dto'

@Injectable()
export class TradingSetupsService
{
    private cache: { [key: string]: TradingSetupModel } = {}

    constructor()
    {
        const setupsFile = getFile('setups.json')
        const setups = JSON.parse(setupsFile) as TradingSetupModel[]
        for(const setup of setups){
            this.cache[setup.id] = setup
        }
    }
  
    getAll() : TradingSetupModel[]
    {
        return Object.values(this.cache)
    }

    get(id: string) : TradingSetupModel | undefined
    {
        return this.cache[id]
    }

    save(tradingSetup: TradingSetupModel) : TradingSetupModel
    {
        this.cache[tradingSetup.id] = tradingSetup
        return tradingSetup
    }

    create(config: TradingSetupConfigModel, startingFirstAmount: string, startingSecondAmount: string) : TradingSetupModel
    {
        const template = new TradingSetupModel()
        
        const o = {
            ...template,
            id: `${Date.now()}`,
            config,
            startingFirstAmount,
            startingSecondAmount,
            firstAmount: startingFirstAmount,
            secondAmount: startingSecondAmount
        }
        this.save(o)

        createOrWriteToFile('/', 'setups.json', JSON.stringify(this.getAll()))

        return o
    }

    remove(id: string) : TradingSetupModel | undefined
    {
        const temp = this.cache[id]
        delete this.cache[id]
        return temp
    }
}