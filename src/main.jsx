import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import './index.css'
import App from './App.jsx'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#ffc665', contrastText: '#432c00' },
    secondary: { main: '#4cd7f6' },
    success: { main: '#54ea7e' },
    background: { default: '#101319', paper: '#191c22' },
    text: { primary: '#e1e2eb', secondary: '#94a3b8' },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    button: { fontWeight: 700, textTransform: 'none' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: { root: { backgroundColor: '#1d2026' } },
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
