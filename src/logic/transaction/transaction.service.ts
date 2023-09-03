import { Injectable } from '@nestjs/common'
import MathUtils from 'src/lib/mathUtils'
import TradingSetupModel from 'src/models/trading/TradingSetupModel.dto'
import TradingTransactionModel from 'src/models/trading/transaction/TradingTransactionModel.dto'
import { MainClient, NewSpotOrderParams } from 'binance'
import { TradingSetupConfigModelUtils } from 'src/models/trading/TradingSetupConfigModel.dto'
import BinanceTransactionModel, { BinanceTransactionModelUtils } from 'src/models/trading/transaction/BinanceTransactionModel.dto'

@Injectable()
export class TransactionService
{
    client : MainClient
    wallet_free = {}
    wallet_locked = {}
    limit_orders = {}

    setup()
    {
        const baseUrl = process.env.BINANCE_USE_TEST === 'True' ? 'https://testnet.binance.vision' : undefined
        
        this.client = new MainClient({
            api_key: process.env.BINANCE_API_KEY,
            api_secret: process.env.BINANCE_API_SECRET,
            baseUrl
        })

        this.updateWalletBalances()
        // this.makeMarketBuyTransaction('BTCBUSD', '20')
        // this.makeMarketTransaction('BTCBUSD', '0.000771', false)
        this.makeLimitTransaction('BTCBUSD', '0.000771', '25910', true)
    }
    
    async makeTransaction(setup: TradingSetupModel, action: number) : Promise<TradingTransactionModel> | undefined
    {
        console.log("makeTransaction for action: " + action + " and setup: ", setup)
        if (action == 0) { return }

        const buy = action > 0 // action < 0 == SELL
        const { walletAmount, tradeAmount } = this.getTradeAmounts(setup, buy)

        return this.makeTrade(setup, walletAmount, tradeAmount, buy)
    }

    private getTradeAmounts(setup: TradingSetupModel, buy: boolean)
    {
        let walletAmount = '0'
        let tradeAmount = '0'
        if (buy){
            walletAmount = this.wallet_free[setup.config.tokenSecond]
            tradeAmount = setup.secondAmount
        }else{
            walletAmount = this.wallet_free[setup.config.tokenFirst]
            tradeAmount = setup.firstAmount
        }
        return { walletAmount, tradeAmount }
    }

    private async makeTrade(setup: TradingSetupModel, walletAmount: string, tradeAmount: string, buy: boolean) : Promise<TradingTransactionModel | undefined>
    {
        if (MathUtils.IsBiggerThanZero(tradeAmount) && MathUtils.IsBiggerThanZero(walletAmount)){
            const amount = MathUtils.Min(walletAmount, tradeAmount)
            let response : any | undefined

            if (setup.config.useLimitOrders){
                response = undefined
            }else{
                response = await this.makeMarketTransaction(TradingSetupConfigModelUtils.GetTokenPair(setup.config), amount, buy)
            }
            
            if (response){
                const binanceTransaction = BinanceTransactionModelUtils.FromResponse(setup.config.tokenFirst, setup.config.tokenSecond, response)
                this.updateWalletFromTransaction(binanceTransaction)
                return BinanceTransactionModelUtils.ToTradingTransaction(binanceTransaction)
            }
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
        // if (buy){
        //     parameters['quoteOrderQty'] = Number(quantity)
        // }else{
        //     parameters['quantity'] = Number(quantity)
        // }
        try{
            const response = await this.client.submitNewOrder(parameters as NewSpotOrderParams)
            console.log("binance limit order: ", response)
            return response
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
        //TODO: this is inefficient/lazy to do - improve
        for (const b of Object.keys(this.wallet_locked)){
            if (MathUtils.IsBiggerThanZero(this.wallet_locked[b])){
                this.client.cancelAllSymbolOrders({ symbol: b }).then(() => {
                    this.updateWalletBalances()
                })
                return
            }
        }
    }

    private updateWalletFromTransaction(transaction: BinanceTransactionModel)
    {
        if (transaction.buy){
            this.wallet_free[transaction.firstToken] = MathUtils.AddNumbers(this.wallet_free[transaction.firstToken], transaction.firstAmount)
            this.wallet_free[transaction.secondToken] = MathUtils.SubtractNumbers(this.wallet_free[transaction.secondToken], transaction.secondAmount)
        }else{
            this.wallet_free[transaction.firstToken] = MathUtils.SubtractNumbers(this.wallet_free[transaction.firstToken], transaction.firstAmount)
            this.wallet_free[transaction.secondToken] = MathUtils.AddNumbers(this.wallet_free[transaction.secondToken], transaction.secondAmount)
        }
    }
}