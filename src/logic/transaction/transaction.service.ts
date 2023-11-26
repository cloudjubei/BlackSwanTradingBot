import { Injectable } from '@nestjs/common'
import TradingSetupModel from 'models/trading/TradingSetupModel.dto'
import TradingTransactionModel, { TradingTransactionModelUtils } from 'models/trading/transaction/TradingTransactionModel.dto'
import { CancelSpotOrderResult, MainClient, NewSpotOrderParams, SpotAssetBalance, SpotOrder } from 'binance'
import { TradingSetupConfigModelUtils } from 'models/trading/TradingSetupConfigModel.dto'
import MathUtils from "commons/lib/mathUtils"
import ArrayUtils from "commons/lib/arrayUtils"
import { IdentityService } from 'logic/identity/identity.service'
import WalletModel from 'models/WalletModel.dto'
import TradingSetupActionModel, { TradingSetupActionModelUtils } from 'models/trading/action/TradingSetupActionModel.dto'
import TradingSetupTradeModel from 'models/trading/trade/TradingSetupTradeModel.dto'
import TradingSetupActionType from 'models/trading/action/TradingSetupActionType.dto'

@Injectable()
export class TransactionService
{
    private client : MainClient
    private walletFree = new WalletModel()
    private walletLocked = new WalletModel()
    private walletMarginFree = new WalletModel()
    private walletMarginLocked = new WalletModel()

    constructor(
        private readonly identityService: IdentityService,
    )
    {
        const config = this.identityService.config
        for(const token of Object.keys(config.minimum_amounts)){
            this.walletFree.amounts[token] = '0'
            this.walletLocked.amounts[token] = '0'
            this.walletMarginFree.amounts[token] = '0'
            this.walletMarginLocked.amounts[token] = '0'
        }
    }

    async updateWalletFree() : Promise<WalletModel>
    {
        await this.updateWalletBalances()
        return this.walletFree
    }
    getWalletFree() : WalletModel
    {
        return this.walletFree
    }
    getWalletLocked() : WalletModel
    {
        return this.walletLocked
    }

    async updateWalletMarginFree() : Promise<WalletModel>
    {
        await this.updateMarginWalletBalances()
        return this.walletMarginFree
    }
    getWalletMarginFree() : WalletModel
    {
        return this.walletMarginFree
    }
    getWalletMarginLocked() : WalletModel
    {
        return this.walletMarginLocked
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
        // await this.makeMarketTransaction('BTCFDUSD', '0.00246', false, true)
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
        await this.updateMarginWalletBalances(false)
    }

    async updateTransaction(setup: TradingSetupModel, transaction: TradingTransactionModel) : Promise<TradingTransactionModel>
    {
        if (transaction.complete){ return transaction }
        
        const response = await this.getOrder(setup, transaction)

        console.log("updateTransaction BINANCE RESPONSE:")
        console.log(response)
        let newTransaction =  TradingTransactionModelUtils.FromBinanceTransactionResponse(setup, transaction, response)

        if (this.shouldCancel(setup, newTransaction)){
            try{
                const cancelResponse = await this.cancelOrder(setup, newTransaction)
                console.log("cancelOrder response: ")
                console.log(cancelResponse)
                newTransaction = TradingTransactionModelUtils.FromBinanceTransactionResponse(setup, newTransaction, cancelResponse)
            }catch(e){
                if (e.code === -2011){
                    console.log("CANCEL ERROR UNKNOWN ORDER")
                }
                console.log("CANCEL ERROR: ")
                console.log(e)
                newTransaction.complete = true
                newTransaction.canceled = true
            }
        }
        return newTransaction
    }

    private async getOrder(setup: TradingSetupModel, transaction: TradingTransactionModel) : Promise<SpotOrder>
    {
        if (setup.config.isMarginAccount){
            return this.client.queryMarginAccountOrder({ symbol: TradingTransactionModelUtils.GetTokenPair(transaction), orderId: Number(transaction.transactionId) })
        }
        return this.client.getOrder({  symbol: TradingTransactionModelUtils.GetTokenPair(transaction), orderId: Number(transaction.transactionId) })
    }

    private async cancelOrder(setup: TradingSetupModel, transaction: TradingTransactionModel) : Promise<CancelSpotOrderResult>
    {
        if (setup.config.isMarginAccount){
            return this.client.marginAccountCancelOrder({ symbol: TradingTransactionModelUtils.GetTokenPair(transaction), orderId: Number(transaction.transactionId) })
        }
        return this.client.cancelOrder({  symbol: TradingTransactionModelUtils.GetTokenPair(transaction), orderId: Number(transaction.transactionId) })
    }

    canMakeTransaction(setup: TradingSetupModel, action: TradingSetupActionModel, trade: TradingSetupTradeModel = undefined) : boolean
    {
        if (TradingSetupActionModelUtils.IsNoOp(action)) { return false }

        const buy = TradingSetupActionModelUtils.IsBuy(action)
        const tradeAmount = this.getTradeAmount(setup, buy, trade)

        return MathUtils.IsBiggerThanZero(tradeAmount)
    }
    
    async makeTransaction(setup: TradingSetupModel, action: TradingSetupActionModel, trade: TradingSetupTradeModel = undefined) : Promise<TradingTransactionModel> | undefined
    {
        if (TradingSetupActionModelUtils.IsNoOp(action)) { return }

        const buy = TradingSetupActionModelUtils.IsBuy(action)
        const tradeAmount = this.getTradeAmount(setup, buy, trade)

        if (!MathUtils.IsBiggerThanZero(tradeAmount)) { return }

        return this.makeTrade(setup, tradeAmount, buy, setup.config.useLimitOrders && action.type !== TradingSetupActionType.STOPLOSS)
    }

    private getTradeAmount(setup: TradingSetupModel, buy: boolean, trade: TradingSetupTradeModel = undefined)
    {
        let walletAmount = '0'
        let tradeAmount = '0'
        let minAmount = '0'
        if (buy){
            walletAmount = (setup.config.isMarginAccount ? this.walletMarginFree.amounts[setup.config.secondToken] : this.walletFree.amounts[setup.config.secondToken]) ?? '0'
            tradeAmount = setup.secondAmount
            minAmount = this.identityService.getMinAmounts()[setup.config.secondToken]
        }else{
            walletAmount = (setup.config.isMarginAccount ? this.walletMarginFree.amounts[setup.config.firstToken] : this.walletFree.amounts[setup.config.firstToken]) ?? '0'
            tradeAmount = trade?.firstAmount ?? setup.firstAmount
            minAmount = this.identityService.getMinAmounts()[setup.config.firstToken]
        }
        const possibleAmount = MathUtils.Min(walletAmount, tradeAmount)
        return MathUtils.IsGreaterThanOrEqualTo(possibleAmount, minAmount) ? possibleAmount : '0'
    }

    private async makeTrade(setup: TradingSetupModel, amount: string, buy: boolean, limitOrder: boolean) : Promise<TradingTransactionModel | undefined>
    {
        let response : any | undefined

        let wantedPrice = setup.currentPriceAmount
        if (limitOrder){
            wantedPrice = this.getLimitPrice(setup, buy)
            const quantity = this.getLimitQuantity(amount, wantedPrice, buy)
            console.log("makeTrade LIMIT " + (buy ? "BUY" : "SELL") + " currentPrice: " + setup.currentPriceAmount + " wantedPrice: " + wantedPrice + " quantity: " + quantity + " for setup id: " + setup.id)
            response = await this.makeLimitTransaction(TradingSetupConfigModelUtils.GetTokenPair(setup.config), quantity, wantedPrice, buy, setup.config.useLimitMakerOrders, setup.config.isMarginAccount)
        }else{
            response = await this.makeMarketTransaction(TradingSetupConfigModelUtils.GetTokenPair(setup.config), amount, buy, setup.config.isMarginAccount)
        }
        
        console.log("BINANCE RESPONSE:")
        console.log(response)
        if (response){
            return TradingTransactionModelUtils.FromBinanceResponse(setup.config.firstToken, setup.config.secondToken, amount, wantedPrice, response)
        }else{
            setup.failedDueToMarketMaking += 1
        }
    }

    private async makeMarketTransaction(tokenPair: string, quantity: string, buy: boolean, isMargin: boolean = false) : Promise<any | undefined>
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
            if (isMargin){
                return await this.client.marginAccountNewOrder(parameters as NewSpotOrderParams)
            }
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
    private async makeLimitTransaction(tokenPair: string, quantity: string, price: string, buy: boolean, limitMaker: boolean = false, isMargin: boolean = false) : Promise<any | undefined>
    {
        let parameters = {
            symbol: tokenPair,
            type: limitMaker ? 'LIMIT_MAKER' : 'LIMIT',
            side: buy ? 'BUY' : 'SELL',
            quantity: Number(quantity),
            price: Number(price)
        }
        if (!limitMaker){
            parameters['timeInForce'] = 'GTC'
        }
        try{
            if (isMargin){
                return await this.client.marginAccountNewOrder(parameters as NewSpotOrderParams)
            }
            return await this.client.submitNewOrder(parameters as NewSpotOrderParams)
        }catch(e){
            console.error("binance market transaction error: ", e?.body)
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
    private async updateMarginWalletBalances(walletOnly: boolean = true)
    {
        await this.client.queryCrossMarginAccountDetails().then((result) => {
            if (!walletOnly){
                console.log('getAllMarginAssets result: ', result)
            }

            for(const token of Object.keys(this.walletMarginFree.amounts)){
                this.walletMarginFree.amounts[token] = '0'
                this.walletMarginLocked.amounts[token] = '0'
            }

            for(const r of result.userAssets){
                const token = r.asset
                if (this.walletMarginFree.amounts[token] !== undefined){
                    this.walletMarginFree.amounts[token] = MathUtils.AddNumbers(this.walletMarginFree.amounts[token], "" + r.free)
                    this.walletMarginLocked.amounts[token] = MathUtils.AddNumbers(this.walletMarginLocked.amounts[token], "" + r.locked)
                }
            }
        })
        .catch((err) => {
            console.error('queryCrossMarginAccountDetails error: ', err);
        })
    }

    private setupWallet(balances: SpotAssetBalance[], walletOnly: boolean = true)
    {
        for (const b of balances){
            const token = b.asset
            if (this.walletFree.amounts[token] !== undefined){
                this.walletFree.amounts[token] = "" + b.free
                this.walletLocked.amounts[token] = "" + b.locked
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
        if (transaction.complete || transaction.canceled) { return false }
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
}