import { Injectable } from '@nestjs/common'
import MathUtils from 'src/lib/mathUtils'
import TradingSetupModel from 'src/models/trading/TradingSetupModel.dto'
import TradingTransactionModel, { TradingTransactionModelUtils } from 'src/models/trading/transaction/TradingTransactionModel.dto'
import { MainClient, NewSpotOrderParams } from 'binance'
import { TradingSetupConfigModelUtils } from 'src/models/trading/TradingSetupConfigModel.dto'
import BinanceTransactionModel, { BinanceTransactionModelUtils } from 'src/models/trading/transaction/BinanceTransactionModel.dto'
import ArrayUtils from 'src/lib/arrayUtils'
import { getFile } from 'src/lib/storageUtils'
import ConfigModel from 'src/models/config/ConfigModel.dto'

@Injectable()
export class TransactionService
{
    private client : MainClient
    private wallet_free = {}
    private wallet_locked = {}
    private MINIMUM_AMOUNTS = {}

    constructor()
    {
        const configFile = getFile('config.json')
        const config = JSON.parse(configFile) as ConfigModel
        for(const token in config.minimum_amounts){
            this.MINIMUM_AMOUNTS[token] = config.minimum_amounts[token]
        }
    }

    async setup()
    {
        const baseUrl = process.env.BINANCE_USE_TEST === 'True' ? 'https://testnet.binance.vision' : undefined
        
        this.client = new MainClient({
            api_key: process.env.BINANCE_API_KEY,
            api_secret: process.env.BINANCE_API_SECRET,
            baseUrl
        })

        // this.makeMarketBuyTransaction('BTCBUSD', '20')
        // await this.makeMarketTransaction('BTCBUSD', '0.34549100', false)
        // this.makeLimitTransaction('BTCBUSD', '0.000771', '25970', false)
        // this.updateTransaction({
        //     buy: false,
        //     firstToken: 'BTC',
        //     secondToken: 'BUSD',
        //     firstAmount: '0.000771',
        //     secondAmount: '0',
        //     priceAmount: '25970',
        //     transactionId: '9094819',
        //     complete: false,
        //     checks: 0,
        //     firstUpdateTimestamp: Date.now(),
        //     lastUpdateTimestamp: Date.now()
        // })
        await this.updateWalletBalances()
    }

    async updateTransaction(setup: TradingSetupModel, transaction: TradingTransactionModel) : Promise<TradingTransactionModel>
    {
        if (!transaction.complete){
            return this.client.getOrder({  symbol: TradingTransactionModelUtils.GetTokenPair(transaction), orderId: Number(transaction.transactionId) })
            .then(response => {
                const newTransaction = this.processBinanceResponse(setup, response, transaction)

                if (this.shouldCancel(setup, newTransaction)){
                    return this.client.cancelOrder({  symbol: TradingTransactionModelUtils.GetTokenPair(transaction), orderId: Number(transaction.transactionId) })
                    .then(response => {
                        return this.processBinanceResponse(setup, response, newTransaction)
                    })
                }
                return newTransaction
            })
        }
        return transaction
    }
    
    async makeTransaction(setup: TradingSetupModel, action: number) : Promise<TradingTransactionModel> | undefined
    {
        console.log("makeTransaction for action: " + action + " and setup id: ", setup.id)
        if (action == 0) { return }
        if (Math.abs(action) < setup.config.signalThreshold) { return }

        const buy = action > 0 // action < 0 == SELL
        const tradeAmount = this.getTradeAmount(setup, buy)

        if (!MathUtils.IsBiggerThanZero(tradeAmount)) { return }

        return this.makeTrade(setup, tradeAmount, buy)
    }

    private getTradeAmount(setup: TradingSetupModel, buy: boolean)
    {
        let walletAmount = '0'
        let tradeAmount = '0'
        if (buy){
            walletAmount = this.wallet_free[setup.config.secondToken] ?? '0'
            tradeAmount =  MathUtils.IsGreaterThanOrEqualTo(setup.secondAmount, this.MINIMUM_AMOUNTS[setup.config.secondToken]) ? setup.secondAmount : '0' 
        }else{
            walletAmount = this.wallet_free[setup.config.firstToken] ?? '0'
            tradeAmount =  MathUtils.IsGreaterThanOrEqualTo(setup.firstAmount, this.MINIMUM_AMOUNTS[setup.config.firstToken]) ? setup.firstAmount : '0' 
        }
        return MathUtils.Min(walletAmount, tradeAmount)
    }

    private async makeTrade(setup: TradingSetupModel, amount: string, buy: boolean) : Promise<TradingTransactionModel | undefined>
    {
        let response : any | undefined

        if (setup.config.useLimitOrders){
            const price = this.getLimitPrice(setup, buy)
            const quantity = this.getLimitQuantity(amount, price, buy)
            response = await this.makeLimitTransaction(TradingSetupConfigModelUtils.GetTokenPair(setup.config), quantity, price, buy)
        }else{
            response = await this.makeMarketTransaction(TradingSetupConfigModelUtils.GetTokenPair(setup.config), amount, buy)
        }
        
        if (response){
            return this.processBinanceResponse(setup, response)
        }
    }

    private async makeMarketTransaction(tokenPair: string, quantity: string, buy: boolean) : Promise<any | undefined>
    {
        let parameters = {
            symbol: tokenPair,
            type: 'MARKET',
            side: buy ? 'BUY' : 'SELL'
        }
        if (buy){
            parameters['quoteOrderQty'] = Number(quantity)
        }else{
            parameters['quantity'] = Number(quantity)
        }
        try{
            return await this.client.submitNewOrder(parameters as NewSpotOrderParams)
        }catch(e){
            console.error("binance market transaction error: ", e)
        }
    }
    private getLimitPrice(setup: TradingSetupModel, buy: boolean) : string
    {
        const multiplier = buy ? ("" + setup.config.limitOrderBuyOffset) : ("-" + setup.config.limitOrderSellOffset)
        const price = MathUtils.MultiplyNumbers(setup.currentPriceAmount, MathUtils.AddNumbers("1", multiplier))
        return MathUtils.Shorten(price, 2)
    }
    private getLimitQuantity(amount: string, price: string, buy: boolean) : string
    {
        const quantity = buy ? MathUtils.DivideNumbers(amount, price) : amount
        return MathUtils.Shorten(quantity, 5)
    }
    private async makeLimitTransaction(tokenPair: string, quantity: string, price: string, buy: boolean) : Promise<any | undefined>
    {
        let parameters = {
            symbol: tokenPair,
            type: 'LIMIT',
            side: buy ? 'BUY' : 'SELL',
            quantity: Number(quantity),
            price: Number(price),
            timeInForce: 'GTC'
        }
        try{
            return await this.client.submitNewOrder(parameters as NewSpotOrderParams)
        }catch(e){
            console.error("binance market transaction error: ", e)
        }
    }

    private updateWalletBalances()
    {
        this.client
        .getAccountInformation()
        .then((result) => {
            console.log('getAccountInformation result: ', result)
            this.setupWallet(result.balances)
        })
        .catch((err) => {
            console.error('getAccountInformation error: ', err);
        })
    }

    private setupWallet(balances: Array<any>)
    {
        for (const b of balances){
            this.wallet_free[b['asset']] = b['free']
            this.wallet_locked[b['asset']] = b['locked']
        }

        this.client.getOpenOrders().then(orders => {
            const symbols = ArrayUtils.FilterUnique(orders.map(o => o.symbol))
            Promise.all(symbols.map(symbol => this.client.cancelAllSymbolOrders({ symbol })))
            .catch((err) => {
                console.error('getAccountInformation error: ', err);
            })
        })
        .catch((err) => {
            console.error('getAccountInformation error: ', err);
        })
    }

    private shouldCancel(setup: TradingSetupModel, transaction: TradingTransactionModel) : boolean
    {
        if (transaction.checks > setup.config.limitOrderCancelDueToChecksElapsed){
            return true
        }
        if (setup.config.limitOrderCancelDueToTimeElapsed){
            const timeElapsed = transaction.lastUpdateTimestamp - transaction.firstUpdateTimestamp
            if (timeElapsed > setup.config.limitOrderCancelDueToTimeElapsed * 1000){
                return true
            }
        }
        if (setup.config.limitOrderCancelDueToPriceDivergence){
            const priceDifference = MathUtils.Abs(MathUtils.SubtractNumbers(setup.currentPriceAmount, transaction.priceAmount))
            if (MathUtils.IsGreaterThan(priceDifference, setup.config.limitOrderCancelDueToPriceDivergence)){
                return true
            }
        }
        return false
    }

    private processBinanceResponse(setup: TradingSetupModel, response: any, transaction?: TradingTransactionModel)
    {
        const binanceTransaction = BinanceTransactionModelUtils.FromResponse(setup.config.firstToken, setup.config.secondToken, response)
        this.updateWalletFromTransaction(binanceTransaction)
        return BinanceTransactionModelUtils.ToTradingTransaction(binanceTransaction, transaction)
    }

    private updateWalletFromTransaction(transaction: BinanceTransactionModel)
    {
        if (!BinanceTransactionModelUtils.IsCompleted(transaction)) { return }
        if (transaction.buy){
            this.wallet_free[transaction.firstToken] = MathUtils.AddNumbers(this.wallet_free[transaction.firstToken], transaction.firstAmount)
            this.wallet_free[transaction.secondToken] = MathUtils.SubtractNumbers(this.wallet_free[transaction.secondToken], transaction.secondAmount)
        }else{
            this.wallet_free[transaction.firstToken] = MathUtils.SubtractNumbers(this.wallet_free[transaction.firstToken], transaction.firstAmount)
            this.wallet_free[transaction.secondToken] = MathUtils.AddNumbers(this.wallet_free[transaction.secondToken], transaction.secondAmount)
        }
    }
}