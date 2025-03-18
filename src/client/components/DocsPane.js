import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookIcon,
  SearchIcon,
  LoaderIcon,
  ArrowRightIcon,
  XIcon,
  RotateCcwIcon,
} from 'lucide-react'

import documentationData from '../public/data/docs.json'
import { usePane } from './usePane'

export function Docspane({ world, close }) {
  const paneRef = useRef()
  const headRef = useRef()
  usePane('docs', paneRef, headRef)
  const [query, setQuery] = useState('')
  const [refresh, setRefresh] = useState(0)

  return (
    <div
      ref={paneRef}
      className='docspane'
      css={css`
        position: absolute;
        top: 20px;
        left: 20px;
        width: 540px;
        height: 600px;
        background: rgba(22, 22, 28, 1);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 10px;
        box-shadow: rgba(0, 0, 0, 0.5) 0px 10px 30px;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        .docspane-head {
          height: 50px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 13px 0 20px;
          &-title {
            padding-left: 7px;
            font-weight: 500;
            flex: 1;
          }
          &-search {
            width: 150px;
            display: flex;
            align-items: center;
            svg {
              margin-right: 5px;
            }
            input {
              flex: 1;
              font-size: 14px;
              background: transparent;
              border: none;
              color: white;
              outline: none;
              &::placeholder {
                color: rgba(255, 255, 255, 0.5);
              }
            }
          }
          &-btn {
            width: 30px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.5);
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
      `}
    >
      <div className='docspane-head' ref={headRef}>
        <BookIcon size={16} />
        <div className='docspane-head-title'>Documentation</div>
        <div className='docspane-head-search'>
          <SearchIcon size={16} />
          <input type='text' placeholder='Search' value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className='docspane-head-btn' onClick={() => setRefresh(n => n + 1)}>
          <RotateCcwIcon size={16} />
        </div>
        <div className='docspane-head-btn' onClick={() => world.emit('docs', null)}>
          <XIcon size={20} />
        </div>
      </div>
      <DocspaneContent world={world} query={query} refresh={refresh} />
    </div>
  )
}

function DocspaneContent({ query, refresh }) {
  const [expandedSections, setExpandedSections] = useState({})
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setData(documentationData)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [refresh])

  const filteredData = useMemo(() => {
    if (!data || !query) return data

    const lowerCaseQuery = query.toLowerCase()
    return Object.keys(data).reduce((acc, key) => {
      const item = data[key]
      const matchesTitle = item.title.toLowerCase().includes(lowerCaseQuery)
      const matchesDescription = item.description.toLowerCase().includes(lowerCaseQuery)
      const matchesProperties = Object.values(item.properties || {}).some(prop =>
        prop.description.toLowerCase().includes(lowerCaseQuery)
      )
      const matchesMethods = Object.values(item.methods || {}).some(method =>
        method.description.toLowerCase().includes(lowerCaseQuery)
      )

      if (matchesTitle || matchesDescription || matchesProperties || matchesMethods) {
        acc[key] = item
      }
      return acc
    }, {})
  }, [data, query])

  const toggleSection = (key) => {
    setExpandedSections(prevState => {
      // Check if the section is already expanded
      if (prevState[key]) {
        return {
          ...prevState,
          [key]: false
        }
      }

      // Close all other sections and expand the clicked one
      const newExpanded = Object.keys(prevState).reduce((acc, k) => {
        acc[k] = false
        return acc
      }, {})

      newExpanded[key] = true

      return newExpanded
    })
  }

  if (loading) {
    return (
      <div className='docspane-loader' css={css`
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        color: rgba(255, 255, 255, 0.5);
      `}>
        <LoaderIcon size={16} />
        <span style={{ marginLeft: '10px' }}>Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className='docspane-error' css={css`
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        color: rgba(255, 0, 0, 0.5);
      `}>
        <XIcon size={16} />
        <span style={{ marginLeft: '10px' }}>Error loading documentation</span>
      </div>
    )
  }

  return (
    <div
      className='docspane-content'
      css={css`
        flex: 1;
        padding: 20px 20px 0;
        overflow-y: auto;
        maxHeight: 450px;
         scrollbar-width: none;  /* For Firefox */
        &::-webkit-scrollbar {
          display: none;  /* For Chrome, Safari and Opera */
        }
        .docspane-section {
          margin-bottom: 10px;
          max-height: 500px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          background: rgba(35, 35, 45, 1);
          overflow-y: auto;
          scrollbar-width: none;  /* For Firefox */
          &::-webkit-scrollbar {
            display: none;  /* For Chrome, Safari and Opera */
          }

          &-header {
            display: flex;
            align-items: center;
            cursor: pointer;
            padding: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);

            &:hover {
              background: rgba(45, 45, 55, 1);
            }
          }

          &-title {
            font-size: 16px;
            font-weight: 500;
            margin-left: 10px;
          }

          &-description {
            padding: 10px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
          }

          &-content {
            padding: 0 10px;
            background: rgba(45, 45, 55, 1);
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.2s ease-out, padding 0.2s ease-out;

            &.expanded {
              max-height: 500px;
              padding: 10px;
              overflow-y: auto;
              scrollbar-width: none;  /* For Firefox */
              &::-webkit-scrollbar {
              display: none;  /* For Chrome, Safari and Opera */
              }

            }
          }
        }

        .docspane-item {
          margin-bottom: 10px;
          padding: 10px;
          border-radius: 6px;
          background: rgba(35, 35, 45, 1);

          &-name {
            font-weight: 500;
            margin-bottom: 4px;
          }

          &-type {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 4px;
          }

          &-description {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
          }
        }
      `}
    >
      {!filteredData || Object.keys(filteredData).length === 0 ? (
        <div className='docspane-empty' css={css`
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: rgba(255, 255, 255, 0.5);
        `}>
          <span>No results found</span>
        </div>
      ) : (
        Object.entries(filteredData).map(([key, item]) => (
          <div key={key} className='docspane-section'>
            <div className='docspane-section-header' onClick={() => toggleSection(key)}>
              <ArrowRightIcon
                size={16}
                css={css`
                  transform: ${expandedSections[key] ? 'rotate(90deg)' : 'rotate(0deg)'};
                  transition: transform 0.2s;
                `}
              />
              <div className='docspane-section-title'>{item.title}</div>
            </div>
            <div className='docspane-section-description'>{item.description}</div>
            <div className={`docspane-section-content ${expandedSections[key] ? 'expanded' : ''}`}>
              {item.properties && Object.entries(item.properties).map(([propKey, prop]) => (
                <div key={propKey} className='docspane-item'>
                  <div className='docspane-item-name'>{propKey}</div>
                  <div className='docspane-item-type'>{prop.type}</div>
                  <div className='docspane-item-description'>{prop.description}</div>
                </div>
              ))}
              {item.methods && Object.entries(item.methods).map(([methodKey, method]) => (
                <div key={methodKey} className='docspane-item'>
                  <div className='docspane-item-name'>{methodKey}</div>
                  <div className='docspane-item-description'>{method.description}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
