import { ApiProperty } from "@nestjs/swagger"
import { StringMap } from "commons/models/swagger.consts"

export default class WalletModel
{
    @ApiProperty(StringMap) amounts: { [token: string] : string } = {}

    constructor(amounts: { [token: string] : string } = {})
    {
        this.amounts = amounts
    }
}
