const { mode } = window.__pdm__
const ACCOUNT_CHANGE_EVENT = 'accountChanged'

export default class Header {
  constructor(options) {
    this.config = options.config
    this.service = options.service
    this.eb = options.eb

    this.vm = new Vue({
      el: '#header',
      data: {
        overview: {
          totalSupplyAccLiteral: 0,
          totalReservesAccLiteral: 0,
          totalBorrowsAccLiteral: 0,
          rds: {},
          dol: {},
        },
        walletInstalled: false,
        walletButtonText: '',
        loginAccount: null,
        theme: 'dark',
        loaded: false,
        liquidity: 0,
      },
      methods: {
        login: this.login.bind(this),
        toogleTheme: this.toogleTheme.bind(this),
      },
      computed: {
        ellipsisAccount() {
          if (!this.loginAccount) return ''
          const len = this.loginAccount.length
          return this.loginAccount.slice(0, 8) + '...' + this.loginAccount.slice(len - 6, len)
        },
        accountUrl() {
          if (!this.loginAccount) return ''
          return `https://${options.config.explorer}/address/${this.loginAccount}`
        },
        accountLiquidity() {
          return this.liquidity.toFixed(2)
        },
      },
    })
    this.mode = mode
    this.mode.set('light')
  }

  async initialize() {
    this.eb.on('overviewLoaded', this.setOverviewData.bind(this))
  }

  setOverviewData(overview) {
    this.vm.overview = overview
    this.vm.loaded = true
  }

  run() {
    const checkWallet = this._checkWallet.bind(this)
    this.service.wallet.onAccountChanged(checkWallet)
    this.service.wallet.onChainChanged(checkWallet)
    checkWallet()

    const refresh = this._refresh.bind(this)
    setInterval(refresh, this.config.refreshInterval)
    refresh()
  }

  toogleTheme() {
    const newTheme = this.vm.theme === 'dark' ? 'light' : 'dark'
    this.mode.set(this.vm.theme)
    this.vm.theme = newTheme
  }

  login() {
    const wallet = this.service.wallet
    wallet
      .connect()
      .then(() => {
        this._checkWallet()
      })
      .catch((err) => {
        alert('Wallet Connect Error:' + err)
      })
  }

  _showWalletButton(text) {
    logger.debug('wallet button text', text)
    this.vm.walletButtonText = text
    this.vm.loginAccount = null
  }

  _checkWallet() {
    const wallet = this.service.wallet
    if (!wallet.isInstalled()) {
      this.vm.walletInstalled = false
      return
    }
    this.vm.walletInstalled = true

    if (!wallet.isConnected()) {
      return this._showWalletButton('Login')
    }
    if (wallet.getChainId() !== this.service.realdao.chainId()) {
      M.toast({ html: 'Wrong Network!', classes: 'rounded' })
      return this._showWalletButton('Wrong Network')
    }
    wallet
      .getDefaultAccount()
      .then((account) => {
        logger.debug('selectAccount:', account)
        if (account) {
          this.vm.loginAccount = account

          const provider = this.service.wallet.currentProvider()
          this.service.realdao.setProvider(provider)
          this.eb.emit(ACCOUNT_CHANGE_EVENT, account)
        } else {
          this._showWalletButton('Login')
        }
      })
      .catch((err) => {
        // logger.debug('failed to get account:', err)
        M.toast({ html: 'Failed to get account', classes: 'rounded' })
        this._showWalletButton('Account Not Found')
      })
  }

  async _refresh() {
    if (!this.vm.loginAccount) return
    const realdao = this.service.realdao
    const result = await realdao.getAccountLiquidity(this.vm.loginAccount)
    this.vm.liquidity = result.shortfall < 0 ? result.shortfallLiteral : result.liquidityLiteral
  }
}
