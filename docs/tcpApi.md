# Packets

#### Packets are seperated to 2 thing, packet name and args. </br>
#### Example: PacketName > getWalletData/WOWAKAFIWALLET < Args</br>
#### To seperate args you can use | for seperating. </br>
#### Also, every packet must end with && due to nature of TCP they can mixed.

## getWalletData/<WalletAddress>

Returns data of given wallet, eg: balance. </br>
Example sended data: walletData/{balance: 100}