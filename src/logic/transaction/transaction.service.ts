import { Injectable } from '@nestjs/common'
import TradingSetupModel from 'models/trading/TradingSetupModel.dto'
import TradingTransactionModel, { TradingTransactionModelUtils } from 'models/trading/transaction/TradingTransactionModel.dto'
import { MainClient, NewSpotOrderParams } from 'binance'
import { TradingSetupConfigModelUtils } from 'models/trading/TradingSetupConfigModel.dto'
import BinanceTransactionModel, { BinanceTransactionModelUtils } from 'models/trading/transaction/BinanceTransactionModel.dto'
import MathUtils from "commons/lib/mathUtils"
import ArrayUtils from "commons/lib/arrayUtils"
import { IdentityService } from 'logic/identity/identity.service'
import WalletModel from 'models/WalletModel.dto'

@Injectable()
export class TransactionService
{
    private client : MainClient
    private walletFree = new WalletModel()
    private walletLocked = new WalletModel()

    constructor(
        private readonly identityService: IdentityService,
    )
    {
        const config = this.identityService.config
        for(const token of Object.keys(config.minimum_amounts)){
            this.walletFree.amounts[token] = '0'
            this.walletLocked.amounts[token] = '0'
        }
    }

    async getWalletFree() : Promise<WalletModel>
    {
        await this.updateWalletBalances()
        return this.walletFree
    }
    getWalletLocked() : WalletModel
    {
        return this.walletLocked
    }
    async convertAllBTC() : Promise<WalletModel>
    {
        const amount = this.walletFree.amounts['BTC']
        await this.makeMarketTransaction('BTCUSDT', amount, false)
        await this.updateWalletBalances()
        return this.walletFree
    }

    async setup()
    {
        const baseUrl = process.env.BINANCE_USE_TEST === 'True' ? 'https://testnet.binance.vision' : undefined
        
        this.client = new MainClient({
            api_key: process.env.BINANCE_API_KEY,
            api_secret: process.env.BINANCE_API_SECRET,
            baseUrl
        })

        // await this.makeMarketTransaction('BTCBUSD', '41795.75', true)
        // await this.makeMarketTransaction('BTCUSDT', '0.369470', false)
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
        await this.updateWalletBalances(false)
    }

    async updateTransaction(setup: TradingSetupModel, transaction: TradingTransactionModel) : Promise<TradingTransactionModel>
    {
        if (!transaction.complete){
            return this.client.getOrder({  symbol: TradingTransactionModelUtils.GetTokenPair(transaction), orderId: Number(transaction.transactionId) })
            .then(response => {
                const newTransaction = this.processBinanceResponse(setup, transaction.wantedPriceAmount, response, transaction)

                if (this.shouldCancel(setup, newTransaction)){
                    return this.client.cancelOrder({  symbol: TradingTransactionModelUtils.GetTokenPair(transaction), orderId: Number(transaction.transactionId) })
                    .then(response => {
                        return this.processBinanceResponse(setup, newTransaction.wantedPriceAmount, response, newTransaction)
                    })
                }
                return newTransaction
            })
        }
        return transaction
    }
    
    async makeTransaction(setup: TradingSetupModel, action: number) : Promise<TradingTransactionModel> | undefined
    {
        if (action == 0) { return }

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
            walletAmount = this.walletFree.amounts[setup.config.secondToken] ?? '0'
            tradeAmount =  MathUtils.IsGreaterThanOrEqualTo(setup.secondAmount, this.identityService.getMinAmounts()[setup.config.secondToken]) ? setup.secondAmount : '0' 
        }else{
            walletAmount = this.walletFree.amounts[setup.config.firstToken] ?? '0'
            tradeAmount =  MathUtils.IsGreaterThanOrEqualTo(setup.firstAmount, this.identityService.getMinAmounts()[setup.config.firstToken]) ? setup.firstAmount : '0' 
        }
        return MathUtils.Min(walletAmount, tradeAmount)
    }

    private async makeTrade(setup: TradingSetupModel, amount: string, buy: boolean) : Promise<TradingTransactionModel | undefined>
    {
        let response : any | undefined

        let wantedPrice = setup.currentPriceAmount
        if (setup.config.useLimitOrders){
            wantedPrice = this.getLimitPrice(setup, buy)
            const quantity = this.getLimitQuantity(amount, wantedPrice, buy)
            console.log("makeTrade LIMIT " + (buy ? "BUY" : "SELL") + " currentPrice: " + setup.currentPriceAmount + " wantedPrice: " + wantedPrice + " quantity: " + quantity + " for setup id: " + setup.id)
            response = await this.makeLimitTransaction(TradingSetupConfigModelUtils.GetTokenPair(setup.config), quantity, wantedPrice, buy)
        }else{
            response = await this.makeMarketTransaction(TradingSetupConfigModelUtils.GetTokenPair(setup.config), amount, buy)
        }
        
        if (response){
            return this.processBinanceResponse(setup, wantedPrice, response)
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
        const multiplier = buy ? MathUtils.AddNumbers("1", ("" + setup.config.limitOrderBuyOffset)) : MathUtils.SubtractNumbers("1", ("" + setup.config.limitOrderSellOffset))
        const price = MathUtils.MultiplyNumbers(setup.currentPriceAmount, multiplier)
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
            type: 'LIMIT_MAKER',
            side: buy ? 'BUY' : 'SELL',
            quantity: Number(quantity),
            price: Number(price),
            // timeInForce: 'GTC'
        }
        try{
            return await this.client.submitNewOrder(parameters as NewSpotOrderParams)
        }catch(e){
            console.error("binance market transaction error: ", e)
        }
    }

    private async updateWalletBalances(walletOnly: boolean = true)
    {
        await this.client
        .getAccountInformation()
        .then((result) => {
            if (!walletOnly){
                console.log('getAccountInformation result: ', result)
            }
            this.setupWallet(result.balances, walletOnly)
        })
        .catch((err) => {
            console.error('getAccountInformation error: ', err);
        })
    }

    private setupWallet(balances: Array<any>, walletOnly: boolean = true)
    {
        for (const b of balances){
            const token = b['asset']
            if (this.walletFree.amounts[token] !== undefined){
                this.walletFree.amounts[token] = b['free']
                this.walletLocked.amounts[token] = b['locked']
            }
        }

        if (walletOnly){ return }
    
        console.log("this.wallet_free: ", this.walletFree.amounts)

        for(const tokenPair of this.identityService.getTokens()){
            this.client.getTradeFee({ symbol: tokenPair }).then( response => {
                console.log("TRADING FEE:")
                console.log(response)
            }).catch(err => {
                console.log("CANNOT GET TRADING FEE FOR: " + tokenPair)   
            })
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
        if (transaction.canceled) { return false }
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
            const priceDifference = MathUtils.Abs(MathUtils.SubtractNumbers(setup.currentPriceAmount, transaction.wantedPriceAmount))
            if (MathUtils.IsGreaterThan(priceDifference, setup.config.limitOrderCancelDueToPriceDivergence)){
                return true
            }
        }
        return false
    }

    private processBinanceResponse(setup: TradingSetupModel, wantedPrice: string, response: any, transaction?: TradingTransactionModel)
    {
        const binanceTransaction = BinanceTransactionModelUtils.FromResponse(setup.config.firstToken, setup.config.secondToken, wantedPrice, response)
        return BinanceTransactionModelUtils.ToTradingTransaction(binanceTransaction, transaction)
    }
}